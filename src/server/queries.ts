import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import {
  accessRequests,
  dropStrains,
  accounts,
  claimCodes,
  deposits,
  events,
  inventory,
  invitations,
  orderLines,
  orders,
  prices,
  products,
  redemptions,
  regions,
  selectionLineups,
  waitlistEntries,
  wholesaleApplications,
} from "@/db/schema";
import { releaseExpiredHolds } from "@/server/orders";

export async function getRegionBySlug(slug: string) {
  const [region] = await getDb().select().from(regions).where(eq(regions.slug, slug)).limit(1);
  return region ?? null;
}

export async function listEventsForRegion(slug: string) {
  const region = await getRegionBySlug(slug);
  if (!region?.enabled) return [];
  return getDb()
    .select()
    .from(events)
    .where(and(eq(events.regionId, region.id), eq(events.cancelled, false), eq(events.archived, false)))
    .orderBy(asc(events.startsAt));
}

export async function getEventBySlug(slug: string) {
  const [row] = await getDb()
    .select({ event: events, region: regions })
    .from(events)
    .innerJoin(regions, eq(regions.id, events.regionId))
    .where(eq(events.slug, slug))
    .limit(1);
  return row ?? null;
}

export type MenuItem = {
  id: string;
  slug: string;
  name: string;
  kind: "selection" | "jar" | "selection_set";
  editionNumber: number | null;
  subtitle: string;
  description: string;
  imagePath: string | null;
  lineup: string;
  amountCents: number;
  available: number;
};

export async function retailMenu(regionId: string, eventId?: string): Promise<MenuItem[]> {
  await releaseExpiredHolds();
  const rows = await getDb()
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      kind: products.kind,
      editionNumber: products.editionNumber,
      subtitle: products.subtitle,
      description: products.description,
      imagePath: products.imagePath,
      lineup: selectionLineups.lineup,
      amountCents: prices.amountCents,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .innerJoin(
      prices,
      and(
        eq(prices.productId, products.id),
        eq(prices.regionId, regionId),
        eq(prices.channel, "retail"),
      ),
    )
    .innerJoin(
      inventory,
      and(eq(inventory.productId, products.id), eq(inventory.regionId, regionId)),
    )
    .leftJoin(
      selectionLineups,
      and(
        eq(selectionLineups.productId, products.id),
        eventId ? eq(selectionLineups.eventId, eventId) : sql`false`,
      ),
    )
    .where(eq(products.active, true))
    .orderBy(asc(products.sortOrder));

  return rows
    .filter((row) => row.kind === "selection" || row.kind === "jar")
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind as "selection" | "jar",
      editionNumber: row.editionNumber,
      subtitle: row.subtitle,
      description: row.description,
      imagePath: row.imagePath,
      lineup: row.lineup ?? "",
      amountCents: row.amountCents,
      available: row.onHand - row.reserved,
    }));
}

export async function wholesaleMenu(regionId: string) {
  const rows = await getDb()
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      kind: products.kind,
      subtitle: products.subtitle,
      description: products.description,
      imagePath: products.imagePath,
      amountCents: prices.amountCents,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .innerJoin(
      prices,
      and(
        eq(prices.productId, products.id),
        eq(prices.regionId, regionId),
        eq(prices.channel, "wholesale"),
      ),
    )
    .leftJoin(
      inventory,
      and(eq(inventory.productId, products.id), eq(inventory.regionId, regionId)),
    )
    .where(eq(products.active, true))
    .orderBy(asc(products.sortOrder));

  const boxes = await getDb()
    .select({
      onHand: inventory.onHand,
      reserved: inventory.reserved,
    })
    .from(products)
    .innerJoin(
      inventory,
      and(eq(inventory.productId, products.id), eq(inventory.regionId, regionId)),
    )
    .where(and(eq(products.kind, "selection"), eq(products.active, true)));

  const setAvailable =
    boxes.length === 16 ? Math.min(...boxes.map((box) => box.onHand - box.reserved)) : 0;

  const set = rows.find((row) => row.kind === "selection_set") ?? null;
  const jars = rows
    .filter((row) => row.kind === "jar")
    .map((row) => ({
      id: row.id,
      name: row.name,
      subtitle: row.subtitle,
      description: row.description,
      imagePath: row.imagePath,
      amountCents: row.amountCents,
      available: (row.onHand ?? 0) - (row.reserved ?? 0),
    }));

  return {
    set: set
      ? {
          id: set.id,
          name: set.name,
          subtitle: set.subtitle,
          description: set.description,
          imagePath: set.imagePath,
          amountCents: set.amountCents,
          available: setAvailable,
        }
      : null,
    jars,
  };
}

export async function listOrdersForAccount(accountId: string) {
  return getDb()
    .select({ order: orders, region: regions, event: events })
    .from(orders)
    .innerJoin(regions, eq(regions.id, orders.regionId))
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.accountId, accountId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrderDetail(id: string) {
  const [row] = await getDb()
    .select({ order: orders, region: regions, event: events, account: accounts })
    .from(orders)
    .innerJoin(regions, eq(regions.id, orders.regionId))
    .innerJoin(accounts, eq(accounts.id, orders.accountId))
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return null;
  const lines = await getDb().select().from(orderLines).where(eq(orderLines.orderId, id));
  const depositRows = await getDb().select().from(deposits).where(eq(deposits.orderId, id));
  return { ...row, lines, deposits: depositRows };
}

export async function getOrderByPickupToken(token: string) {
  const [row] = await getDb()
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.pickupToken, token))
    .limit(1);
  if (!row) return null;
  return getOrderDetail(row.id);
}

export async function listWholesaleRegions() {
  return getDb()
    .select()
    .from(regions)
    .where(eq(regions.channel, "wholesale"))
    .orderBy(asc(regions.sortOrder));
}

export async function accountApplication(accountId: string) {
  const [row] = await getDb()
    .select({ application: wholesaleApplications, region: regions })
    .from(wholesaleApplications)
    .innerJoin(regions, eq(regions.id, wholesaleApplications.requestedRegionId))
    .where(eq(wholesaleApplications.accountId, accountId))
    .orderBy(desc(wholesaleApplications.createdAt))
    .limit(1);
  return row ?? null;
}

export async function adminSnapshot() {
  const db = getDb();
  const [pendingAccounts] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(accounts)
    .where(eq(accounts.status, "pending"));
  const [openApplications] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(wholesaleApplications)
    .where(eq(wholesaleApplications.status, "pending"));
  const [newRequests] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(accessRequests)
    .where(sql`${accessRequests.reviewedAt} is null`);
  const [openOrders] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(sql`${orders.status} not in ('completed', 'cancelled')`);
  return {
    pendingAccounts: Number(pendingAccounts?.n ?? 0),
    openApplications: Number(openApplications?.n ?? 0),
    newRequests: Number(newRequests?.n ?? 0),
    openOrders: Number(openOrders?.n ?? 0),
  };
}

export async function listPendingAccounts() {
  return getDb()
    .select()
    .from(accounts)
    .where(eq(accounts.status, "pending"))
    .orderBy(asc(accounts.createdAt));
}

export async function listAccessRequests() {
  return getDb().select().from(accessRequests).orderBy(desc(accessRequests.createdAt));
}

export async function listApplications() {
  return getDb()
    .select({ application: wholesaleApplications, region: regions, account: accounts })
    .from(wholesaleApplications)
    .innerJoin(regions, eq(regions.id, wholesaleApplications.requestedRegionId))
    .innerJoin(accounts, eq(accounts.id, wholesaleApplications.accountId))
    .orderBy(desc(wholesaleApplications.createdAt));
}

export async function listInvitations() {
  return getDb()
    .select({ invitation: invitations, region: regions })
    .from(invitations)
    .leftJoin(regions, eq(regions.id, invitations.regionId))
    .orderBy(desc(invitations.createdAt));
}

export async function listAllEvents() {
  return getDb()
    .select({ event: events, region: regions })
    .from(events)
    .innerJoin(regions, eq(regions.id, events.regionId))
    .orderBy(asc(events.startsAt));
}

export async function listRetailRegions() {
  return getDb()
    .select()
    .from(regions)
    .where(and(eq(regions.channel, "retail"), eq(regions.enabled, true)))
    .orderBy(asc(regions.sortOrder));
}

export async function listInventory(regionId?: string) {
  return getDb()
    .select({
      inventory,
      product: products,
      region: regions,
    })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .innerJoin(regions, eq(regions.id, inventory.regionId))
    .where(
      regionId
        ? and(eq(products.active, true), eq(inventory.regionId, regionId))
        : eq(products.active, true),
    )
    .orderBy(asc(regions.sortOrder), asc(products.sortOrder));
}

export async function listAllOrders(eventId?: string) {
  await releaseExpiredHolds();
  const query = getDb()
    .select({ order: orders, region: regions, account: accounts, event: events })
    .from(orders)
    .innerJoin(regions, eq(regions.id, orders.regionId))
    .innerJoin(accounts, eq(accounts.id, orders.accountId))
    .leftJoin(events, eq(events.id, orders.eventId))
    .orderBy(desc(orders.createdAt));
  if (!eventId) return query;
  return query.where(eq(orders.eventId, eventId));
}

export async function listLineups(eventId: string) {
  return getDb().select().from(selectionLineups).where(eq(selectionLineups.eventId, eventId));
}

export async function waitlistForEvent(eventId: string) {
  return getDb()
    .select({ entry: waitlistEntries, account: accounts })
    .from(waitlistEntries)
    .innerJoin(accounts, eq(accounts.id, waitlistEntries.accountId))
    .where(eq(waitlistEntries.eventId, eventId))
    .orderBy(asc(waitlistEntries.createdAt));
}

export async function accountOnWaitlist(accountId: string, eventId: string) {
  const [row] = await getDb()
    .select()
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.accountId, accountId), eq(waitlistEntries.eventId, eventId)))
    .limit(1);
  return row ?? null;
}

export async function listWholesaleBuyers() {
  return getDb()
    .select({ account: accounts, region: regions })
    .from(accounts)
    .leftJoin(regions, eq(regions.id, accounts.regionId))
    .where(eq(accounts.role, "wholesale_buyer"))
    .orderBy(asc(accounts.email));
}

export async function getDropOffer(eventId: string, regionId: string) {
  await releaseExpiredHolds();
  const strains = await getDb()
    .select()
    .from(dropStrains)
    .where(eq(dropStrains.eventId, eventId))
    .orderBy(asc(dropStrains.position));
  const [event] = await getDb().select().from(events).where(eq(events.id, eventId)).limit(1);
  const [box] = await getDb().select().from(products).where(eq(products.slug, "selection-box")).limit(1);
  const [jar] = await getDb().select().from(products).where(eq(products.slug, "jar-7g")).limit(1);
  const [boxPrice] = box
    ? await getDb()
        .select()
        .from(prices)
        .where(and(eq(prices.productId, box.id), eq(prices.regionId, regionId), eq(prices.channel, "retail")))
        .limit(1)
    : [];
  const [jarPrice] = jar
    ? await getDb()
        .select()
        .from(prices)
        .where(and(eq(prices.productId, jar.id), eq(prices.regionId, regionId), eq(prices.channel, "retail")))
        .limit(1)
    : [];
  return {
    strains,
    boxesAvailable: event ? event.boxOnHand - event.boxReserved : 0,
    boxOnHand: event?.boxOnHand ?? 0,
    boxCents: boxPrice?.amountCents ?? 0,
    jarCents: jarPrice?.amountCents ?? 0,
  };
}

export async function listDevAccounts() {
  return getDb().select().from(accounts).orderBy(asc(accounts.email));
}

export async function listClaimCodes(limit = 200) {
  const claimer = accounts;
  return getDb()
    .select({
      code: claimCodes,
      eventName: events.name,
      claimerName: claimer.name,
      claimerEmail: claimer.email,
    })
    .from(claimCodes)
    .leftJoin(events, eq(events.id, claimCodes.eventId))
    .leftJoin(claimer, eq(claimer.id, claimCodes.claimedBy))
    .orderBy(desc(claimCodes.createdAt))
    .limit(limit);
}

export async function listClaimBatch(batchId: string) {
  return getDb()
    .select({
      code: claimCodes,
      eventName: events.name,
    })
    .from(claimCodes)
    .leftJoin(events, eq(events.id, claimCodes.eventId))
    .where(eq(claimCodes.batchId, batchId))
    .orderBy(asc(claimCodes.createdAt));
}

export async function listRedemptions() {
  return getDb()
    .select({
      redemption: redemptions,
      accountName: accounts.name,
      accountEmail: accounts.email,
    })
    .from(redemptions)
    .innerJoin(accounts, eq(accounts.id, redemptions.accountId))
    .orderBy(desc(redemptions.createdAt));
}

export async function listRedemptionsForAccount(accountId: string) {
  return getDb()
    .select()
    .from(redemptions)
    .where(eq(redemptions.accountId, accountId))
    .orderBy(desc(redemptions.createdAt));
}
