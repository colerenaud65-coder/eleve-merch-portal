import { randomBytes } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { referenceCodes } from "@/db/catalog";
import { getDb, type Database } from "@/db/index";
import {
  accounts,
  events,
  inventory,
  orderLines,
  orders,
  prices,
  products,
  regions,
  type Order,
} from "@/db/schema";
import { depositDue } from "@/server/money";

export class OrderError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type LineInput = {
  productId: string;
  quantity: number;
  regionId: string;
};

const MIXED =
  "An order cannot mix regions. Canadian and US stock stay fully separate.";

function referenceFor(slug: string) {
  const code = referenceCodes[slug] ?? "ELV";
  return `ELV-${code}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function uniqueNumber(tx: Tx) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const number = `ES-${randomBytes(3).toString("hex").toUpperCase()}`;
    const [existing] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.number, number))
      .limit(1);
    if (!existing) return number;
  }
  throw new OrderError("Could not assign an order number.", "number");
}

async function stockNeeds(tx: Tx, lines: { productId: string; quantity: number }[]) {
  const ids = [...new Set(lines.map((line) => line.productId))];
  const rows = await tx.select().from(products).where(inArray(products.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const needs = new Map<string, number>();
  const boxes = await tx.select().from(products).where(eq(products.kind, "selection"));

  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) throw new OrderError("Unknown product.", "product");
    if (product.kind === "selection_set") {
      if (boxes.length !== 16) {
        throw new OrderError("The selection of 16 is not fully catalogued.", "catalog");
      }
      for (const box of boxes) {
        needs.set(box.id, (needs.get(box.id) ?? 0) + line.quantity);
      }
    } else {
      needs.set(product.id, (needs.get(product.id) ?? 0) + line.quantity);
    }
  }
  return needs;
}

async function reserve(tx: Tx, regionId: string, needs: Map<string, number>) {
  for (const [productId, quantity] of needs) {
    const updated = await tx
      .update(inventory)
      .set({ reserved: sql`${inventory.reserved} + ${quantity}` })
      .where(
        and(
          eq(inventory.productId, productId),
          eq(inventory.regionId, regionId),
          sql`${inventory.onHand} - ${inventory.reserved} >= ${quantity}`,
        ),
      )
      .returning({ id: inventory.id });
    if (updated.length === 0) {
      throw new OrderError(
        "A numbered box or jar in this order is no longer available in this region.",
        "stock",
      );
    }
  }
}

async function release(tx: Tx, regionId: string, needs: Map<string, number>) {
  for (const [productId, quantity] of needs) {
    const updated = await tx
      .update(inventory)
      .set({ reserved: sql`${inventory.reserved} - ${quantity}` })
      .where(
        and(
          eq(inventory.productId, productId),
          eq(inventory.regionId, regionId),
          sql`${inventory.reserved} >= ${quantity}`,
        ),
      )
      .returning({ id: inventory.id });
    if (updated.length === 0) {
      throw new OrderError("Reserved stock could not be released.", "stock");
    }
  }
}

async function commitSold(tx: Tx, regionId: string, needs: Map<string, number>) {
  for (const [productId, quantity] of needs) {
    const updated = await tx
      .update(inventory)
      .set({
        onHand: sql`${inventory.onHand} - ${quantity}`,
        reserved: sql`${inventory.reserved} - ${quantity}`,
      })
      .where(
        and(
          eq(inventory.productId, productId),
          eq(inventory.regionId, regionId),
          sql`${inventory.reserved} >= ${quantity}`,
          sql`${inventory.onHand} >= ${quantity}`,
        ),
      )
      .returning({ id: inventory.id });
    if (updated.length === 0) {
      throw new OrderError("Stock could not be marked picked up.", "stock");
    }
  }
}

export async function placeOrder(input: {
  accountId: string;
  kind: "preorder" | "wholesale";
  eventId?: string | null;
  lines: LineInput[];
  notes?: string | null;
}): Promise<Order> {
  const lines = input.lines.filter((line) => line.quantity > 0);
  if (lines.length === 0) {
    throw new OrderError("Choose at least one box or jar.", "empty");
  }
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 48) {
      throw new OrderError("Quantity is not valid.", "quantity");
    }
  }

  const regionIds = new Set(lines.map((line) => line.regionId));
  if (regionIds.size !== 1) {
    throw new OrderError(MIXED, "mixed_region");
  }
  const requestedRegionId = [...regionIds][0];

  return getDb().transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.accountId))
      .limit(1);
    if (!account || account.status !== "approved") {
      throw new OrderError("This account cannot order yet.", "account");
    }

    let regionId = requestedRegionId;
    let channel: "retail" | "wholesale" = "retail";
    let eventId: string | null = null;

    if (input.kind === "preorder") {
      if (account.role !== "popup_customer" && account.role !== "admin") {
        throw new OrderError("Pop-up preorders are for collector accounts.", "role");
      }
      if (!input.eventId) throw new OrderError("Choose a drop.", "event");
      const [event] = await tx.select().from(events).where(eq(events.id, input.eventId)).limit(1);
      if (!event) throw new OrderError("This drop does not exist.", "event");
      if (!event.complianceConfirmed) {
        throw new OrderError(
          "Preorders stay closed until compliance is confirmed for this drop.",
          "compliance",
        );
      }
      const now = new Date();
      if (now < event.preorderOpensAt || now >= event.preorderClosesAt) {
        throw new OrderError("Preorders are not open for this drop.", "window");
      }
      if (event.regionId !== requestedRegionId) {
        throw new OrderError(MIXED, "mixed_region");
      }
      regionId = event.regionId;
      eventId = event.id;
      channel = "retail";
    } else {
      if (account.role !== "wholesale_buyer" && account.role !== "admin") {
        throw new OrderError("Wholesale ordering opens after this desk is approved.", "role");
      }
      if (!account.regionId) {
        throw new OrderError("This wholesale account is not locked to a region.", "region");
      }
      if (account.regionId !== requestedRegionId) {
        throw new OrderError(
          "An order cannot mix regions. This account is locked to its Ontario region.",
          "mixed_region",
        );
      }
      if (input.eventId) {
        throw new OrderError("Wholesale orders are not part of a pop-up.", "event");
      }
      regionId = account.regionId;
      channel = "wholesale";
    }

    const [region] = await tx.select().from(regions).where(eq(regions.id, regionId)).limit(1);
    if (!region) throw new OrderError("Unknown region.", "region");
    if (channel === "retail" && region.channel !== "retail") {
      throw new OrderError("Pop-up preorders use a retail region.", "region");
    }
    if (channel === "wholesale" && region.channel !== "wholesale") {
      throw new OrderError("Wholesale orders use one exclusive Ontario region.", "region");
    }

    const productIds = [...new Set(lines.map((line) => line.productId))];
    const productRows = await tx.select().from(products).where(inArray(products.id, productIds));
    const productMap = new Map(productRows.map((row) => [row.id, row]));
    if (productMap.size !== productIds.length) {
      throw new OrderError("Unknown product.", "product");
    }

    const priced: {
      productId: string;
      quantity: number;
      unitAmountCents: number;
      label: string;
    }[] = [];

    for (const line of lines) {
      const product = productMap.get(line.productId)!;
      if (!product.active) throw new OrderError(`${product.name} is not available.`, "product");
      if (channel === "retail" && product.kind === "selection" && line.quantity !== 1) {
        throw new OrderError("Each numbered box can be reserved once.", "allocation");
      }
      if (channel === "retail" && product.kind === "selection_set") {
        throw new OrderError("The selection of 16 is a wholesale order.", "channel");
      }
      if (channel === "wholesale" && product.kind === "selection") {
        throw new OrderError("Wholesale boxes are ordered as the selection of 16.", "channel");
      }
      const [price] = await tx
        .select()
        .from(prices)
        .where(
          and(
            eq(prices.productId, product.id),
            eq(prices.regionId, regionId),
            eq(prices.channel, channel),
          ),
        )
        .limit(1);
      if (!price) {
        throw new OrderError(`${product.name} has no price in this region.`, "price");
      }
      const label =
        product.kind === "selection" && product.editionNumber
          ? `${String(product.editionNumber).padStart(2, "0")}/16 · ${product.name}`
          : product.name;
      priced.push({
        productId: product.id,
        quantity: line.quantity,
        unitAmountCents: price.amountCents,
        label,
      });
    }

    const needs = await stockNeeds(tx, lines);
    await reserve(tx, regionId, needs);

    const subtotalCents = priced.reduce(
      (sum, line) => sum + line.unitAmountCents * line.quantity,
      0,
    );
    const depositRequiredCents = depositDue(subtotalCents);
    const [order] = await tx
      .insert(orders)
      .values({
        number: await uniqueNumber(tx),
        kind: input.kind,
        status: "awaiting_deposit",
        accountId: account.id,
        regionId,
        eventId,
        currency: region.currency,
        subtotalCents,
        depositRequiredCents,
        depositReceivedCents: 0,
        balanceCents: subtotalCents,
        transferReference: referenceFor(region.slug),
        pickupToken: randomBytes(24).toString("base64url"),
        notes: input.notes?.trim() || null,
      })
      .returning();

    await tx.insert(orderLines).values(
      priced.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        quantity: line.quantity,
        unitAmountCents: line.unitAmountCents,
        label: line.label,
      })),
    );

    return order;
  });
}

async function linesFor(tx: Tx, orderId: string) {
  return tx.select().from(orderLines).where(eq(orderLines.orderId, orderId));
}

export async function cancelOrder(orderId: string) {
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.", "order");
    if (order.status === "cancelled") return order;
    if (order.status === "completed") {
      throw new OrderError("A completed pickup stays on the books.", "status");
    }
    const lines = await linesFor(tx, order.id);
    await release(tx, order.regionId, await stockNeeds(tx, lines));
    const [updated] = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(eq(orders.id, order.id))
      .returning();
    return updated;
  });
}

export async function recordDeposit(input: {
  orderId: string;
  amountCents: number;
  note?: string | null;
  recordedBy: string | null;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new OrderError("Enter the amount that arrived.", "deposit");
  }
  const { deposits } = await import("@/db/schema");
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).for("update");
    if (!order) throw new OrderError("Order not found.", "order");
    if (order.status === "cancelled" || order.status === "completed") {
      throw new OrderError("This order is closed.", "status");
    }
    const depositReceivedCents = order.depositReceivedCents + input.amountCents;
    const balanceCents = Math.max(order.subtotalCents - depositReceivedCents, 0);
    let status = order.status;
    if (
      status === "awaiting_deposit" ||
      status === "deposit_partial" ||
      status === "deposit_received"
    ) {
      status =
        depositReceivedCents < order.depositRequiredCents ? "deposit_partial" : "deposit_received";
    }
    await tx.insert(deposits).values({
      orderId: order.id,
      amountCents: input.amountCents,
      reference: order.transferReference,
      note: input.note?.trim() || null,
      recordedBy: input.recordedBy,
    });
    const [updated] = await tx
      .update(orders)
      .set({ depositReceivedCents, balanceCents, status })
      .where(eq(orders.id, order.id))
      .returning();
    return updated;
  });
}

export async function markReady(orderId: string) {
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.", "order");
    if (order.status !== "deposit_received" && order.status !== "deposit_partial") {
      throw new OrderError("Record the deposit before marking the order ready.", "status");
    }
    const [updated] = await tx
      .update(orders)
      .set({ status: "ready_for_pickup" })
      .where(eq(orders.id, order.id))
      .returning();
    return updated;
  });
}

export async function completeOrder(orderId: string) {
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.", "order");
    if (order.status !== "ready_for_pickup" && order.status !== "deposit_received") {
      throw new OrderError("This order is not ready to close.", "status");
    }
    const lines = await linesFor(tx, order.id);
    await commitSold(tx, order.regionId, await stockNeeds(tx, lines));
    const [updated] = await tx
      .update(orders)
      .set({ status: "completed" })
      .where(eq(orders.id, order.id))
      .returning();
    return updated;
  });
}
