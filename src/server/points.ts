import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db/index";
import { accounts, claimCodes, events, pointsLedger, redemptions } from "@/db/schema";

export const PACKAGE_UNITS = { box: 4, jar: 1 } as const;
export const UNITS_PER_AWARD = 16;
export const POINTS_PER_AWARD = 500;

export const REWARDS = [
  { id: "hat", name: "Hat", points: 500 },
  { id: "tshirt", name: "T-shirt", points: 1000 },
  { id: "hoodie", name: "Hoodie", points: 2000 },
] as const;

export type RewardId = (typeof REWARDS)[number]["id"];
export type PackageKind = keyof typeof PACKAGE_UNITS;

export const PACKAGE_LABEL: Record<PackageKind, string> = {
  box: "4-Strain Box",
  jar: "7 g jar",
};

export function rewardById(id: string) {
  return REWARDS.find((reward) => reward.id === id) ?? null;
}

export function pointsForCrossing(beforeUnits: number, afterUnits: number) {
  const before = Math.floor(beforeUnits / UNITS_PER_AWARD);
  const after = Math.floor(afterUnits / UNITS_PER_AWARD);
  return Math.max(after - before, 0) * POINTS_PER_AWARD;
}

export function unitsTowardNext(lifetimeUnits: number) {
  return lifetimeUnits % UNITS_PER_AWARD;
}

export type ClaimResult =
  | { status: "invalid" }
  | { status: "suspended" }
  | { status: "already-claimed" }
  | { status: "already-yours"; packageKind: PackageKind }
  | { status: "claimed"; packageKind: PackageKind; units: number; awarded: number; balance: number; lifetimeUnits: number };

function newClaimCode() {
  return randomBytes(18).toString("base64url");
}

export async function generateClaimBatch(input: { packageKind: PackageKind; eventId: string | null; count: number }) {
  const count = Math.min(Math.max(Math.trunc(input.count), 1), 48);
  const batchId = randomUUID();
  const rows = Array.from({ length: count }, () => ({
    code: newClaimCode(),
    packageKind: input.packageKind,
    eventId: input.eventId,
    batchId,
  }));
  await getDb().insert(claimCodes).values(rows);
  return batchId;
}

export async function claimPackage(accountId: string, rawCode: string): Promise<ClaimResult> {
  const code = rawCode.trim();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) return { status: "invalid" };

  return getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(claimCodes).where(eq(claimCodes.code, code)).for("update").limit(1);
    if (!row) return { status: "invalid" as const };
    if (row.claimedBy === accountId) return { status: "already-yours" as const, packageKind: row.packageKind };
    if (row.claimedAt || row.claimedBy) return { status: "already-claimed" as const };

    const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for("update").limit(1);
    if (!account || account.status === "suspended") return { status: "suspended" as const };

    const taken = await tx
      .update(claimCodes)
      .set({ claimedBy: accountId, claimedAt: new Date() })
      .where(and(eq(claimCodes.id, row.id), isNull(claimCodes.claimedAt)))
      .returning({ id: claimCodes.id });
    if (taken.length === 0) return { status: "already-claimed" as const };

    const units = PACKAGE_UNITS[row.packageKind];
    const lifetimeUnits = account.lifetimeUnits + units;
    const awarded = pointsForCrossing(account.lifetimeUnits, lifetimeUnits);
    const balance = account.pointsBalance + awarded;

    await tx
      .update(accounts)
      .set({ lifetimeUnits, pointsBalance: balance })
      .where(eq(accounts.id, accountId));
    await tx.insert(pointsLedger).values({
      accountId,
      deltaPoints: 0,
      deltaUnits: units,
      reason: "claim",
      claimCodeId: row.id,
    });
    if (awarded > 0) {
      await tx.insert(pointsLedger).values({
        accountId,
        deltaPoints: awarded,
        deltaUnits: 0,
        reason: "award",
        claimCodeId: row.id,
      });
    }

    return {
      status: "claimed" as const,
      packageKind: row.packageKind,
      units,
      awarded,
      balance,
      lifetimeUnits,
    };
  });
}

export async function requestRedemption(accountId: string, rewardId: string) {
  const reward = rewardById(rewardId);
  if (!reward) return { error: "That reward is not on the list." };

  return getDb().transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for("update").limit(1);
    if (!account || account.status !== "approved") return { error: "This account cannot request merch." };
    if (account.pointsBalance < reward.points) return { error: "Not enough points for that reward." };

    const [redemption] = await tx
      .insert(redemptions)
      .values({
        accountId,
        reward: reward.id,
        points: reward.points,
        status: "pending",
      })
      .returning({ id: redemptions.id });
    if (!redemption) return { error: "The request did not save." };

    await tx
      .update(accounts)
      .set({ pointsBalance: account.pointsBalance - reward.points })
      .where(eq(accounts.id, accountId));
    await tx.insert(pointsLedger).values({
      accountId,
      deltaPoints: -reward.points,
      deltaUnits: 0,
      reason: "redeem",
      redemptionId: redemption.id,
    });
    return { error: null as string | null };
  });
}

export async function fulfillRedemption(redemptionId: string) {
  await getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(redemptions).where(eq(redemptions.id, redemptionId)).for("update").limit(1);
    if (!row || row.status !== "pending") return;
    await tx
      .update(redemptions)
      .set({ status: "fulfilled", fulfilledAt: new Date() })
      .where(and(eq(redemptions.id, row.id), eq(redemptions.status, "pending")));
  });
}

export async function cancelRedemption(redemptionId: string) {
  await getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(redemptions).where(eq(redemptions.id, redemptionId)).for("update").limit(1);
    if (!row || row.status !== "pending") return;
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, row.accountId)).for("update").limit(1);
    if (!account) return;
    const updated = await tx
      .update(redemptions)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(and(eq(redemptions.id, row.id), eq(redemptions.status, "pending")))
      .returning({ id: redemptions.id });
    if (updated.length === 0) return;
    await tx
      .update(accounts)
      .set({ pointsBalance: account.pointsBalance + row.points })
      .where(eq(accounts.id, account.id));
    await tx.insert(pointsLedger).values({
      accountId: account.id,
      deltaPoints: row.points,
      deltaUnits: 0,
      reason: "refund",
      redemptionId: row.id,
    });
  });
}

export async function eventExists(eventId: string) {
  const [row] = await getDb().select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
  return Boolean(row);
}
