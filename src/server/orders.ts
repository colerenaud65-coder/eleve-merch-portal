import { randomBytes } from "node:crypto";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { editionLabel, referenceCodes } from "@/db/catalog";
import { getDb, type Database } from "@/db/index";
import {
  accounts,
  boxAllocations,
  dropStrains,
  events,
  inventory,
  orderLines,
  orders,
  prices,
  products,
  regions,
  type Order,
} from "@/db/schema";
import { depositDue, holdExpiry, termsDays } from "@/server/money";

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
  strainPosition?: number | null;
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

  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) throw new OrderError("Unknown product.", "product");
    if (product.kind === "selection_set") {
      needs.set(product.id, (needs.get(product.id) ?? 0) + line.quantity);
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

async function completePreorder(
  tx: Tx,
  args: {
    account: { id: string; paymentTerms: string };
    region: { id: string; slug: string; currency: string; enabled: boolean };
    eventId: string;
    lines: LineInput[];
    notes: string | null;
  },
): Promise<Order> {
  const [event] = await tx.select().from(events).where(eq(events.id, args.eventId)).for("update");
  if (!event || event.cancelled || event.archived) throw new OrderError("This drop is not open.", "event");
  const [box] = await tx.select().from(products).where(eq(products.slug, "selection-box")).limit(1);
  const [jar] = await tx.select().from(products).where(eq(products.slug, "jar-7g")).limit(1);
  if (!box || !jar) throw new OrderError("The drop catalog is missing.", "catalog");

  const boxLine = args.lines.find((line) => line.productId === box.id);
  const jarLines = args.lines.filter((line) => line.productId === jar.id);
  if (args.lines.some((line) => line.productId !== box.id && line.productId !== jar.id)) {
    throw new OrderError("This drop sells the selection box and jars of its four strains.", "product");
  }
  const boxQty = boxLine?.quantity ?? 0;
  if (boxQty > 16) throw new OrderError("A drop has sixteen boxes.", "quantity");

  const strains = await tx
    .select()
    .from(dropStrains)
    .where(eq(dropStrains.eventId, event.id))
    .orderBy(asc(dropStrains.position));
  if (strains.filter((strain) => strain.name.trim()).length < 4) {
    throw new OrderError("The four-strain lineup is not posted for this drop.", "lineup");
  }

  if (boxQty > 0) {
    const reserved = await tx
      .update(events)
      .set({ boxReserved: sql`${events.boxReserved} + ${boxQty}` })
      .where(and(eq(events.id, event.id), sql`${events.boxOnHand} - ${events.boxReserved} >= ${boxQty}`))
      .returning({ id: events.id });
    if (reserved.length === 0) {
      throw new OrderError("Not enough numbered boxes are left in this drop.", "stock");
    }
  }

  for (const line of jarLines) {
    const position = line.strainPosition ?? 0;
    if (position < 1 || position > 4) throw new OrderError("Choose one of the four strains.", "strain");
    const reserved = await tx
      .update(dropStrains)
      .set({ jarReserved: sql`${dropStrains.jarReserved} + ${line.quantity}` })
      .where(
        and(
          eq(dropStrains.eventId, event.id),
          eq(dropStrains.position, position),
          sql`${dropStrains.jarOnHand} - ${dropStrains.jarReserved} >= ${line.quantity}`,
        ),
      )
      .returning({ id: dropStrains.id });
    if (reserved.length === 0) throw new OrderError("That jar is sold out for this drop.", "stock");
  }

  const [boxPrice] = boxQty
    ? await tx
        .select()
        .from(prices)
        .where(and(eq(prices.productId, box.id), eq(prices.regionId, args.region.id), eq(prices.channel, "retail")))
        .limit(1)
    : [];
  const [jarPrice] = jarLines.length
    ? await tx
        .select()
        .from(prices)
        .where(and(eq(prices.productId, jar.id), eq(prices.regionId, args.region.id), eq(prices.channel, "retail")))
        .limit(1)
    : [];
  if (boxQty && !boxPrice) throw new OrderError("The box has no price in this region.", "price");
  if (jarLines.length && !jarPrice) throw new OrderError("The jar has no price in this region.", "price");

  const numbers: number[] = [];
  if (boxQty > 0) {
    const taken = await tx.select().from(boxAllocations).where(eq(boxAllocations.eventId, event.id));
    const used = new Set(taken.map((row) => row.number));
    for (let number = 1; number <= 16 && numbers.length < boxQty; number += 1) {
      if (!used.has(number)) numbers.push(number);
    }
    if (numbers.length < boxQty) {
      throw new OrderError("Not enough numbered boxes are left in this drop.", "stock");
    }
  }

  const priced: {
    productId: string;
    quantity: number;
    unitAmountCents: number;
    label: string;
    strainPosition: number | null;
  }[] = [];
  if (boxQty && boxPrice) {
    priced.push({
      productId: box.id,
      quantity: boxQty,
      unitAmountCents: boxPrice.amountCents,
      label: `4-Strain Box · ${numbers.map((number) => editionLabel(number)).join(" · ")}`,
      strainPosition: null,
    });
  }
  for (const line of jarLines) {
    const strain = strains.find((item) => item.position === line.strainPosition);
    priced.push({
      productId: jar.id,
      quantity: line.quantity,
      unitAmountCents: jarPrice!.amountCents,
      label: `7 g jar · ${strain?.name ?? "Jar"}`,
      strainPosition: line.strainPosition ?? null,
    });
  }

  const subtotalCents = priced.reduce((sum, line) => sum + line.unitAmountCents * line.quantity, 0);
  const depositRequiredCents = depositDue(subtotalCents);
  const [order] = await tx
    .insert(orders)
    .values({
      number: await uniqueNumber(tx),
      kind: "preorder",
      status: "awaiting_deposit",
      accountId: args.account.id,
      regionId: args.region.id,
      eventId: event.id,
      currency: args.region.currency,
      subtotalCents,
      depositRequiredCents,
      depositReceivedCents: 0,
      balanceCents: subtotalCents,
      transferReference: referenceFor(args.region.slug),
      pickupToken: randomBytes(24).toString("base64url"),
      paymentTerms: "deposit",
      holdExpiresAt: holdExpiry(),
      notes: args.notes?.trim() || null,
    })
    .returning();

  if (numbers.length > 0) {
    await tx.insert(boxAllocations).values(
      numbers.map((number) => ({ eventId: event.id, orderId: order.id, number })),
    );
  }
  await tx.insert(orderLines).values(
    priced.map((line) => ({
      orderId: order.id,
      productId: line.productId,
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
      label: line.label,
      strainPosition: line.strainPosition,
    })),
  );
  return order;
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

  const order = await getDb().transaction(async (tx) => {
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
      if (now >= event.preorderClosesAt) {
        throw new OrderError("Preorders are not open for this drop.", "window");
      }
      if (now < event.preorderOpensAt) {
        const { earlyAccessAt } = await import("@/server/time");
        const { hasEarlyAccess } = await import("@/server/growth");
        const earlyAt = earlyAccessAt(event);
        if (now < earlyAt || !(await hasEarlyAccess(account.id, account.role))) {
          throw new OrderError("Preorders are not open for this drop.", "window");
        }
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
    if (!region.enabled) {
      throw new OrderError("This region is not open.", "region");
    }

    if (input.kind === "preorder") {
      return completePreorder(tx, {
        account,
        region,
        eventId: eventId!,
        lines,
        notes: input.notes ?? null,
      });
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
    const terms = input.kind === "wholesale" ? account.paymentTerms || "deposit" : "deposit";
    const netDays = termsDays(terms);
    const depositRequiredCents = netDays > 0 ? 0 : depositDue(subtotalCents);
    const [order] = await tx
      .insert(orders)
      .values({
        number: await uniqueNumber(tx),
        kind: input.kind,
        status: netDays > 0 ? "on_terms" : "awaiting_deposit",
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
        paymentTerms: terms,
        holdExpiresAt: netDays > 0 ? null : holdExpiry(),
        dueAt: netDays > 0 ? new Date(Date.now() + netDays * 24 * 60 * 60 * 1000) : null,
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
  if (order.kind === "preorder" && order.eventId) {
    const { recordFunnel } = await import("@/server/growth");
    await recordFunnel({
      name: "preorder_placed",
      accountId: order.accountId,
      eventId: order.eventId,
      orderId: order.id,
    });
  }
  return order;
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
    const allocated = await tx.select().from(boxAllocations).where(eq(boxAllocations.orderId, order.id));
    if (order.eventId && (allocated.length > 0 || lines.some((line) => line.strainPosition))) {
      if (allocated.length > 0) {
        const released = await tx
          .update(events)
          .set({ boxReserved: sql`${events.boxReserved} - ${allocated.length}` })
          .where(and(eq(events.id, order.eventId), sql`${events.boxReserved} >= ${allocated.length}`))
          .returning({ id: events.id });
        if (released.length === 0) throw new OrderError("Reserved boxes could not be released.", "stock");
        await tx.delete(boxAllocations).where(eq(boxAllocations.orderId, order.id));
      }
      for (const line of lines) {
        if (!line.strainPosition) continue;
        const released = await tx
          .update(dropStrains)
          .set({ jarReserved: sql`${dropStrains.jarReserved} - ${line.quantity}` })
          .where(
            and(
              eq(dropStrains.eventId, order.eventId),
              eq(dropStrains.position, line.strainPosition),
              sql`${dropStrains.jarReserved} >= ${line.quantity}`,
            ),
          )
          .returning({ id: dropStrains.id });
        if (released.length === 0) throw new OrderError("Reserved jars could not be released.", "stock");
      }
    } else {
      await release(tx, order.regionId, await stockNeeds(tx, lines));
    }
    const [updated] = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(eq(orders.id, order.id))
      .returning();
    return updated;
  });
}

export async function releaseExpiredHolds() {
  const expired = await getDb()
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, "awaiting_deposit"),
        eq(orders.depositReceivedCents, 0),
        sql`${orders.holdExpiresAt} is not null and ${orders.holdExpiresAt} < now()`,
      ),
    );
  for (const row of expired) {
    await cancelOrder(row.id);
    await getDb()
      .update(orders)
      .set({
        notes: "Deposit hold expired. Numbered boxes returned to stock.",
      })
      .where(eq(orders.id, row.id));
  }
  return expired.length;
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
  const result = await getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).for("update");
    if (!order) throw new OrderError("Order not found.", "order");
    if (order.status === "cancelled" || order.status === "completed") {
      throw new OrderError("This order is closed.", "status");
    }
    const depositReceivedCents = order.depositReceivedCents + input.amountCents;
    const balanceCents = Math.max(order.subtotalCents - depositReceivedCents, 0);
    let status = order.status;
    let holdExpiresAt = order.holdExpiresAt;
    if (status === "on_terms") {
      status = depositReceivedCents >= order.subtotalCents ? "deposit_received" : "on_terms";
      if (status === "deposit_received") holdExpiresAt = null;
    } else if (
      status === "awaiting_deposit" ||
      status === "deposit_partial" ||
      status === "deposit_received"
    ) {
      status =
        depositReceivedCents < order.depositRequiredCents ? "deposit_partial" : "deposit_received";
      if (depositReceivedCents >= order.depositRequiredCents) holdExpiresAt = null;
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
      .set({ depositReceivedCents, balanceCents, status, holdExpiresAt })
      .where(eq(orders.id, order.id))
      .returning();
    return {
      updated,
      paid: updated.status === "deposit_received" && order.status !== "deposit_received",
      eventId: order.eventId,
      accountId: order.accountId,
    };
  });
  if (result.paid) {
    const { recordFunnel } = await import("@/server/growth");
    await recordFunnel({
      name: "deposit_paid",
      accountId: result.accountId,
      eventId: result.eventId,
      orderId: result.updated.id,
    });
  }
  return result.updated;
}

export async function markReady(orderId: string) {
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.", "order");
    if (
      order.status !== "deposit_received" &&
      order.status !== "deposit_partial" &&
      order.status !== "on_terms"
    ) {
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
  const closed = await getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new OrderError("Order not found.", "order");
    if (
      order.status !== "ready_for_pickup" &&
      order.status !== "deposit_received" &&
      order.status !== "on_terms"
    ) {
      throw new OrderError("This order is not ready to close.", "status");
    }
    const lines = await linesFor(tx, order.id);
    const allocated = await tx.select().from(boxAllocations).where(eq(boxAllocations.orderId, order.id));
    if (order.eventId && (allocated.length > 0 || lines.some((line) => line.strainPosition))) {
      if (allocated.length > 0) {
        const sold = await tx
          .update(events)
          .set({
            boxOnHand: sql`${events.boxOnHand} - ${allocated.length}`,
            boxReserved: sql`${events.boxReserved} - ${allocated.length}`,
          })
          .where(
            and(
              eq(events.id, order.eventId),
              sql`${events.boxReserved} >= ${allocated.length}`,
              sql`${events.boxOnHand} >= ${allocated.length}`,
            ),
          )
          .returning({ id: events.id });
        if (sold.length === 0) throw new OrderError("Numbered boxes could not be marked picked up.", "stock");
      }
      for (const line of lines) {
        if (!line.strainPosition) continue;
        const sold = await tx
          .update(dropStrains)
          .set({
            jarOnHand: sql`${dropStrains.jarOnHand} - ${line.quantity}`,
            jarReserved: sql`${dropStrains.jarReserved} - ${line.quantity}`,
          })
          .where(
            and(
              eq(dropStrains.eventId, order.eventId),
              eq(dropStrains.position, line.strainPosition),
              sql`${dropStrains.jarReserved} >= ${line.quantity}`,
              sql`${dropStrains.jarOnHand} >= ${line.quantity}`,
            ),
          )
          .returning({ id: dropStrains.id });
        if (sold.length === 0) throw new OrderError("Jars could not be marked picked up.", "stock");
      }
    } else {
      await commitSold(tx, order.regionId, await stockNeeds(tx, lines));
    }
    const [updated] = await tx
      .update(orders)
      .set({ status: "completed", checkedInAt: order.checkedInAt ?? new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    return { updated, eventId: order.eventId, accountId: order.accountId };
  });
  if (closed.eventId) {
    const { recordFunnel } = await import("@/server/growth");
    await recordFunnel({
      name: "picked_up",
      accountId: closed.accountId,
      eventId: closed.eventId,
      orderId: closed.updated.id,
    });
  }
  return closed.updated;
}
