import assert from "node:assert/strict";
import { test } from "node:test";

import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

import { getDb } from "../db/index";
import { accounts, events, inventory, orders, products, regions, waitlistEntries } from "../db/schema";
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

test("orders keep regions apart and allocate numbered boxes", async () => {
  const toronto = await regionBySlug("toronto");
  const vancouver = await regionBySlug("vancouver");
  const horseshoe = await regionBySlug("on-golden-horseshoe");
  const collector = await accountByEmail("toronto@eleve.select");
  const pending = await accountByEmail("pending@eleve.select");
  const applicant = await accountByEmail("applicant@eleve.select");
  const buyer = await accountByEmail("buyer@eleve.select");
  const box = await productBySlug("selection-01");
  const jar = await productBySlug("jar-7g");
  const set = await productBySlug("selection-of-16");
  const kingWest = await eventBySlug("toronto-king-west");
  const railtown = await eventBySlug("vancouver-railtown");
  const losAngeles = await eventBySlug("los-angeles-arts-district");

  await assert.rejects(
    () =>
      placeOrder({
        accountId: collector.id,
        kind: "preorder",
        eventId: kingWest.id,
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
        eventId: kingWest.id,
        lines: [{ productId: jar.id, quantity: 1, regionId: toronto.id }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "account",
  );

  await assert.rejects(
    () =>
      placeOrder({
        accountId: collector.id,
        kind: "preorder",
        eventId: railtown.id,
        lines: [{ productId: jar.id, quantity: 1, regionId: vancouver.id }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "compliance",
  );

  await assert.rejects(
    () =>
      placeOrder({
        accountId: collector.id,
        kind: "preorder",
        eventId: losAngeles.id,
        lines: [{ productId: jar.id, quantity: 1, regionId: losAngeles.regionId }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "window",
  );

  const preorder = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: kingWest.id,
    lines: [
      { productId: box.id, quantity: 1, regionId: toronto.id },
      { productId: jar.id, quantity: 1, regionId: toronto.id },
    ],
  });
  assert.equal(preorder.currency, "CAD");
  assert.equal(preorder.regionId, toronto.id);
  assert.equal(preorder.subtotalCents, 28000 + 8000);
  assert.equal(preorder.depositRequiredCents, 18000);
  assert.equal(preorder.balanceCents, 36000);
  assert.match(preorder.transferReference, /^ELV-TOR-/);
  assert.equal(preorder.status, "awaiting_deposit");

  await assert.rejects(
    () =>
      placeOrder({
        accountId: collector.id,
        kind: "preorder",
        eventId: kingWest.id,
        lines: [{ productId: box.id, quantity: 1, regionId: toronto.id }],
      }),
    (error: unknown) => error instanceof OrderError && error.code === "stock",
  );

  await cancelOrder(preorder.id);
  const again = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: kingWest.id,
    lines: [{ productId: box.id, quantity: 1, regionId: toronto.id }],
  });
  assert.equal(again.subtotalCents, 28000);
  await cancelOrder(again.id);

  const depositOrder = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: kingWest.id,
    lines: [{ productId: jar.id, quantity: 2, regionId: toronto.id }],
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

  const [reservedBox] = await getDb()
    .select()
    .from(inventory)
    .where(eq(inventory.productId, box.id));
  const horseshoeBox = (
    await getDb()
      .select()
      .from(inventory)
      .where(eq(inventory.regionId, horseshoe.id))
  ).find((row) => row.productId === box.id);
  assert.equal(horseshoeBox?.reserved, 1);
  assert.ok(reservedBox);

  await cancelOrder(wholesale.id);
  const [released] = (
    await getDb().select().from(inventory).where(eq(inventory.regionId, horseshoe.id))
  ).filter((row) => row.productId === box.id);
  assert.equal(released.reserved, 0);

  const held = await placeOrder({
    accountId: collector.id,
    kind: "preorder",
    eventId: kingWest.id,
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
    eventId: kingWest.id,
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

  await getDb().insert(waitlistEntries).values({ eventId: kingWest.id, accountId: collector.id });
  await getDb()
    .insert(waitlistEntries)
    .values({ eventId: kingWest.id, accountId: collector.id })
    .onConflictDoNothing();
  const waiting = await getDb()
    .select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.eventId, kingWest.id));
  assert.equal(waiting.length, 1);
});
