import { randomBytes } from "node:crypto";

import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import {
  accounts,
  boxAllocations,
  events,
  funnelEvents,
  orders,
  referrals,
  regions,
} from "@/db/schema";
import { editionLabel } from "@/db/catalog";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeReferralCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function ensureReferralCode(accountId: string) {
  const db = getDb();
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!row) return "";
  if (row.referralCode) return row.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeReferralCode();
    const [updated] = await db
      .update(accounts)
      .set({ referralCode: code })
      .where(and(eq(accounts.id, accountId), isNull(accounts.referralCode)))
      .returning({ referralCode: accounts.referralCode });
    if (updated?.referralCode) return updated.referralCode;
    const [again] = await db.select({ referralCode: accounts.referralCode }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (again?.referralCode) return again.referralCode;
  }
  return "";
}

export async function attachReferral(accountId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  const db = getDb();
  const [referrer] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.referralCode, normalized)).limit(1);
  if (!referrer || referrer.id === accountId) return;
  await db
    .insert(referrals)
    .values({ referrerId: referrer.id, referredId: accountId })
    .onConflictDoNothing({ target: referrals.referredId });
}

export async function referralCount(accountId: string) {
  const [row] = await getDb().select({ total: count() }).from(referrals).where(eq(referrals.referrerId, accountId));
  return row?.total ?? 0;
}

export async function hasEarlyAccess(accountId: string, role?: string) {
  if (role === "admin") return true;
  const db = getDb();
  const [buyer] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.accountId, accountId),
        eq(orders.kind, "preorder"),
        inArray(orders.status, ["deposit_received", "ready_for_pickup", "completed"]),
      ),
    )
    .limit(1);
  if (buyer) return true;
  const [referral] = await db.select({ id: referrals.id }).from(referrals).where(eq(referrals.referrerId, accountId)).limit(1);
  return Boolean(referral);
}

export async function collectorBoxes(accountId: string) {
  return getDb()
    .select({
      number: boxAllocations.number,
      drop: events.name,
      startsAt: events.startsAt,
      timeZone: events.timeZone,
    })
    .from(boxAllocations)
    .innerJoin(orders, eq(orders.id, boxAllocations.orderId))
    .innerJoin(events, eq(events.id, boxAllocations.eventId))
    .where(and(eq(orders.accountId, accountId), ne(orders.status, "cancelled")))
    .orderBy(desc(events.startsAt), asc(boxAllocations.number));
}

export function boxEdition(number: number) {
  return editionLabel(number);
}

const FUNNEL = ["view_drop", "start_preorder", "preorder_placed", "deposit_paid", "picked_up"] as const;
export type FunnelName = (typeof FUNNEL)[number];

export async function recordFunnel(input: {
  name: FunnelName;
  accountId: string;
  eventId?: string | null;
  orderId?: string | null;
}) {
  try {
    await getDb()
      .insert(funnelEvents)
      .values({
        name: input.name,
        accountId: input.accountId,
        eventId: input.eventId ?? null,
        orderId: input.orderId ?? null,
      })
      .onConflictDoNothing({ target: [funnelEvents.accountId, funnelEvents.eventId, funnelEvents.name] });
    const { track } = await import("@vercel/analytics/server");
    await track(input.name, { drop: input.eventId ?? "" });
  } catch {
    // Counting must not block an order.
  }
}

export async function funnelCounts() {
  const rows = await getDb()
    .select({
      name: funnelEvents.name,
      total: sql<number>`count(distinct ${funnelEvents.accountId})::int`,
    })
    .from(funnelEvents)
    .groupBy(funnelEvents.name);
  const byName = new Map(rows.map((row) => [row.name, Number(row.total)]));
  return FUNNEL.map((name) => ({ name, total: byName.get(name) ?? 0 }));
}

export async function consentedContacts(regionId?: string) {
  const rows = await getDb()
    .select({
      name: accounts.name,
      email: accounts.email,
      consentedAt: accounts.marketingConsentAt,
      regionName: regions.name,
    })
    .from(accounts)
    .leftJoin(regions, eq(regions.id, accounts.marketingRegionId))
    .where(
      regionId
        ? and(
            eq(accounts.marketingConsent, true),
            sql`${accounts.marketingConsentAt} is not null`,
            eq(accounts.marketingRegionId, regionId),
          )
        : and(eq(accounts.marketingConsent, true), sql`${accounts.marketingConsentAt} is not null`),
    )
    .orderBy(asc(accounts.email));
  return rows;
}
