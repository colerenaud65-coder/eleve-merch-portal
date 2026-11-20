import assert from "node:assert/strict";
import { test } from "node:test";

import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

import { getDb } from "../db/index";
import { accounts, dropStrains, events, inventory, orderLines, orders, products, regions, waitlistEntries } from "../db/schema";
import { OrderError, cancelOrder, placeOrder, recordDeposit, releaseExpiredHolds } from "./orders";

async function accountByEmail(email: string) {
  const [account] = await getDb().select().from(accounts).where(eq(accounts.email, email)).limit(1);
  if (!account) throw new Error(`Missing seeded account ${email}`);
  return account;
}

async function regionBySlug(slug: string) {
  const [region] = await getDb().select().from(regions).where(eq(regions.slug, slug)).limit(1);
  if (!region) throw new Error(`Missing region ${slug}`);
  return region;
}

async function productBySlug(slug: string) {
  const [product] = await getDb().select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!product) throw new Error(`Missing product ${slug}`);
  return product;
}

async function eventBySlug(slug: string) {
  const [event] = await getDb().select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) throw new Error(`Missing event ${slug}`);
  return event;
}

async function ensureOrderFixtures(input: {
  torontoId: string;
  vancouverId: string;
  horseshoeId: string;
}) {
  const db = getDb();
  const now = Date.now();
  const people = [
    {
      email: "pending@eleve.select",
      name: "Pending collector",
      role: "popup_customer" as const,
      status: "pending" as const,
      regionId: null,
      approvedAt: null,
    },
    {
      email: "toronto@eleve.select",
      name: "Toronto collector",
      role: "popup_customer" as const,
      status: "approved" as const,
      regionId: null,
      approvedAt: new Date(),
    },
    {
      email: "applicant@eleve.select",
      name: "Wholesale applicant",
      role: "wholesale_applicant" as const,
      status: "approved" as const,
      regionId: null,
      approvedAt: new Date(),
    },
    {
      email: "buyer@eleve.select",
      name: "Horseshoe buyer",
      role: "wholesale_buyer" as const,
      status: "approved" as const,
      regionId: input.horseshoeId,
      approvedAt: new Date(),
    },
  ];
  for (const person of people) {
    await db.insert(accounts).values(person).onConflictDoNothing({ target: accounts.email });
  }
  await db
    .update(accounts)
    .set({ role: "wholesale_buyer", status: "approved", regionId: input.horseshoeId, paymentTerms: "deposit" })
    .where(eq(accounts.email, "buyer@eleve.select"));

  const window = {
    startsAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
    endsAt: new Date(now + 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
    preorderOpensAt: new Date(now - 60 * 60 * 1000),
    preorderClosesAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
  };
  await db
    .insert(events)
    .values({
      slug: "test-sunday-service",
      name: "Sunday Service",
      regionId: input.torontoId,
      venue: "Sunday Service by Caked, 1196 Queen St W",
      city: "Toronto",
      summary: "Fixture",
      timeZone: "America/Toronto",
      ...window,
      complianceConfirmed: true,
      complianceConfirmedAt: new Date(),
      boxOnHand: 16,
      boxReserved: 0,
      cancelled: false,
      archived: false,
    })
    .onConflictDoNothing({ target: events.slug });
  await db
    .update(events)
    .set({ ...window, complianceConfirmed: true, cancelled: false, archived: false, boxOnHand: 16, boxReserved: 0 })
    .where(eq(events.slug, "test-sunday-service"));
  await db
    .insert(events)
    .values({
      slug: "test-dank-club",
      name: "Dank Club",
      regionId: input.vancouverId,
      venue: "Dank Club, 6416 Main St",
      city: "Vancouver",
      summary: "Fixture",
      timeZone: "America/Vancouver",
      ...window,
      complianceConfirmed: false,
      boxOnHand: 16,
      boxReserved: 0,
    })
    .onConflictDoNothing({ target: events.slug });
  await db
    .update(events)
    .set({ ...window, complianceConfirmed: false, cancelled: false, archived: false, timeZone: "America/Vancouver" })
    .where(eq(events.slug, "test-dank-club"));

  const sunday = await eventBySlug("test-sunday-service");
  for (let position = 1; position <= 4; position += 1) {
    await db
      .insert(dropStrains)
      .values({ eventId: sunday.id, position, name: "Cut", jarOnHand: 12, jarReserved: 0 })
      .onConflictDoUpdate({
        target: [dropStrains.eventId, dropStrains.position],
        set: { name: "Cut", jarOnHand: 12, jarReserved: 0 },
      });
  }
}

test("orders keep regions apart and allocate numbered boxes", async () => {
  const toronto = await regionBySlug("toronto");
  const vancouver = await regionBySlug("vancouver");
  const horseshoe = await regionBySlug("on-golden-horseshoe");
  await ensureOrderFixtures({
    torontoId: toronto.id,
    vancouverId: vancouver.id,
    horseshoeId: horseshoe.id,
  });
  const collector = await accountByEmail("toronto@eleve.select");
  const pending = await accountByEmail("pending@eleve.select");
  const applicant = await accountByEmail("applicant@eleve.select");
  const buyer = await accountByEmail("buyer@eleve.select");
  const box = await productBySlug("selection-box");
  const jar = await productBySlug("jar-7g");
  const set = await productBySlug("selection-of-16");
  const sunday = await eventBySlug("test-sunday-service");
  const dank = await eventBySlug("test-dank-club");
  const unitedStates = await regionBySlug("united-states");
  assert.equal(unitedStates.enabled, false);

  await assert.rejects(
    () =>
      placeOrder({
        accountId: collector.id,
        kind: "preorder",
        eventId: sunday.id,
        lines: [
          { productId: box.id, quantity: 1, regionId: toronto.id },
          { productId: jar.id, quantity: 1, regionId: vancouver.id },
        ],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "mixed_region",
  );

  await assert.rejects(
    () =>
      placeOrder({
        accountId: pending.id,
        kind: "preorder",
        eventId: sunday.id,
        lines: [{ productId: jar.id, quantity: 1, regionId: toronto.id }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "account",
  );

  await assert.rejects(
    () =>
      placeOrder({
        accountId: collector.id,
        kind: "preorder",
        eventId: dank.id,
        lines: [{ productId: jar.id, quantity: 1, regionId: vancouver.id, strainPosition: 1 }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "compliance",
  );

  const preorder = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: sunday.id,
    lines: [
      { productId: box.id, quantity: 1, regionId: toronto.id },
      { productId: jar.id, quantity: 1, regionId: toronto.id, strainPosition: 1 },
    ],
  });
  assert.equal(preorder.currency, "CAD");
  assert.equal(preorder.regionId, toronto.id);
  assert.equal(preorder.subtotalCents, 28000 + 8000);
  assert.equal(preorder.depositRequiredCents, 18000);
  assert.equal(preorder.balanceCents, 36000);
  assert.match(preorder.transferReference, /^ELV-TOR-/);
  assert.equal(preorder.status, "awaiting_deposit");
  const preorderLines = await getDb().select().from(orderLines).where(eq(orderLines.orderId, preorder.id));
  assert.match(preorderLines.find((line) => line.productId === box.id)?.label ?? "", /01\/16/);

  await assert.rejects(
    () =>
      placeOrder({
        accountId: collector.id,
        kind: "preorder",
        eventId: sunday.id,
        lines: [{ productId: box.id, quantity: 16, regionId: toronto.id }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "stock",
  );

  const nextBox = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: sunday.id,
    lines: [{ productId: box.id, quantity: 1, regionId: toronto.id }],
  });
  const [nextLine] = await getDb().select().from(orderLines).where(eq(orderLines.orderId, nextBox.id));
  assert.match(nextLine?.label ?? "", /02\/16/);
  await cancelOrder(nextBox.id);

  await cancelOrder(preorder.id);
  const again = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: sunday.id,
    lines: [{ productId: box.id, quantity: 1, regionId: toronto.id }],
  });
  assert.equal(again.subtotalCents, 28000);
  await cancelOrder(again.id);

  const depositOrder = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: sunday.id,
    lines: [{ productId: jar.id, quantity: 2, regionId: toronto.id, strainPosition: 1 }],
  });
  assert.equal(depositOrder.subtotalCents, 16000);
  const partial = await recordDeposit({
    orderId: depositOrder.id,
    amountCents: 5000,
    recordedBy: null,
  });
  assert.equal(partial.status, "deposit_partial");
  assert.equal(partial.balanceCents, 11000);
  const paid = await recordDeposit({
    orderId: depositOrder.id,
    amountCents: 11000,
    recordedBy: null,
  });
  assert.equal(paid.status, "deposit_received");
  assert.equal(paid.depositReceivedCents, 16000);
  assert.equal(paid.balanceCents, 0);
  await cancelOrder(depositOrder.id);

  await assert.rejects(
    () =>
      placeOrder({
        accountId: applicant.id,
        kind: "wholesale",
        lines: [{ productId: set.id, quantity: 1, regionId: horseshoe.id }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "role",
  );

  await assert.rejects(
    () =>
      placeOrder({
        accountId: buyer.id,
        kind: "wholesale",
        lines: [{ productId: set.id, quantity: 1, regionId: toronto.id }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "mixed_region",
  );

  const wholesale = await placeOrder({
    accountId: buyer.id,
    kind: "wholesale",
    lines: [
      { productId: set.id, quantity: 1, regionId: horseshoe.id },
      { productId: jar.id, quantity: 3, regionId: horseshoe.id },
    ],
  });
  assert.equal(wholesale.currency, "CAD");
  assert.equal(wholesale.regionId, horseshoe.id);
  assert.equal(wholesale.subtotalCents, 260000 + 3 * 4000);
  assert.equal(wholesale.eventId, null);

  const heldSet = (
    await getDb()
      .select()
      .from(inventory)
      .where(eq(inventory.regionId, horseshoe.id))
  ).find((row) => row.productId === set.id);
  assert.ok((heldSet?.reserved ?? 0) >= 1);

  await cancelOrder(wholesale.id);
  const [released] = (
    await getDb().select().from(inventory).where(eq(inventory.regionId, horseshoe.id))
  ).filter((row) => row.productId === set.id);
  assert.equal(released?.reserved, (heldSet?.reserved ?? 0) - 1);

  const held = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: sunday.id,
    lines: [{ productId: box.id, quantity: 1, regionId: toronto.id }],
  });
  await getDb()
    .update(orders)
    .set({ holdExpiresAt: new Date(Date.now() - 60_000) })
    .where(eq(orders.id, held.id));
  assert.equal(await releaseExpiredHolds(), 1);
  const [expired] = await getDb().select().from(orders).where(eq(orders.id, held.id));
  assert.equal(expired?.status, "cancelled");
  const reopened = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: sunday.id,
    lines: [{ productId: box.id, quantity: 1, regionId: toronto.id }],
  });
  assert.equal(reopened.status, "awaiting_deposit");
  await cancelOrder(reopened.id);

  await getDb().update(accounts).set({ paymentTerms: "net_15" }).where(eq(accounts.id, buyer.id));
  const termed = await placeOrder({
    accountId: buyer.id,
    kind: "wholesale",
    lines: [{ productId: jar.id, quantity: 2, regionId: horseshoe.id }],
  });
  assert.equal(termed.status, "on_terms");
  assert.equal(termed.depositRequiredCents, 0);
  assert.equal(termed.subtotalCents, 8000);
  assert.equal(termed.holdExpiresAt, null);
  assert.ok(termed.dueAt && termed.dueAt.getTime() > Date.now());
  await cancelOrder(termed.id);
  await getDb().update(accounts).set({ paymentTerms: "deposit" }).where(eq(accounts.id, buyer.id));

  await getDb()
    .insert(waitlistEntries)
    .values({ eventId: sunday.id, accountId: collector.id })
    .onConflictDoNothing();
  await getDb()
    .insert(waitlistEntries)
    .values({ eventId: sunday.id, accountId: collector.id })
    .onConflictDoNothing();
  const waiting = await getDb()
    .select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.eventId, sunday.id));
  assert.equal(waiting.length, 1);
});
