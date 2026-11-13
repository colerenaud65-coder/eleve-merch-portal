import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import { accounts, invitations, type Account } from "@/db/schema";

const DEV_COOKIE = "eleve_dev_session";
const INVITE_COOKIE = "eleve_invite";

export function clerkConfigured() {
  return Boolean(
    process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
}

export function devPreviewEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV) return false;
  if (process.env.ALLOW_DEV_PREVIEW !== "true") return false;
  if (process.env.CLERK_SECRET_KEY) return false;
  if (!process.env.DEV_PREVIEW_SECRET) return false;
  return true;
}

function sign(value: string, secret: string) {
  const mac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function readSigned(raw: string | undefined, secret: string | undefined) {
  if (!raw || !secret) return null;
  const index = raw.lastIndexOf(".");
  if (index <= 0) return null;
  const value = raw.slice(0, index);
  const mac = raw.slice(index + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return value;
}

export async function readDevAccountId() {
  if (!devPreviewEnabled()) return null;
  const jar = await cookies();
  return readSigned(jar.get(DEV_COOKIE)?.value, process.env.DEV_PREVIEW_SECRET);
}

export async function setDevSession(accountId: string) {
  if (!devPreviewEnabled() || !process.env.DEV_PREVIEW_SECRET) {
    throw new Error("Local preview sign-in is off.");
  }
  const jar = await cookies();
  jar.set(DEV_COOKIE, sign(accountId, process.env.DEV_PREVIEW_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearDevSession() {
  const jar = await cookies();
  jar.delete(DEV_COOKIE);
}

export async function rememberInvite(token: string) {
  const jar = await cookies();
  jar.set(INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

type ClerkLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  emailAddresses: { emailAddress: string }[];
};

async function openInvite(email: string, token: string | undefined) {
  const db = getDb();
  if (token) {
    const [byToken] = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.token, token), isNull(invitations.acceptedAt)))
      .limit(1);
    if (byToken && byToken.email.toLowerCase() === email) return byToken;
  }
  const [byEmail] = await db
    .select()
    .from(invitations)
    .where(and(sql`lower(${invitations.email}) = ${email}`, isNull(invitations.acceptedAt)))
    .limit(1);
  return byEmail ?? null;
}

export async function syncClerkUser(user: ClerkLike): Promise<Account> {
  const email = (
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    ""
  ).toLowerCase();
  if (!email) throw new Error("This Clerk user has no email address.");

  const jar = await cookies();
  const invite = await openInvite(email, jar.get(INVITE_COOKIE)?.value);
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || email;
  const db = getDb();

  return db.transaction(async (tx) => {
    const [byClerk] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.clerkUserId, user.id))
      .limit(1);
    const [byEmail] = await tx
      .select()
      .from(accounts)
      .where(sql`lower(${accounts.email}) = ${email}`)
      .limit(1);
    const existing = byClerk ?? byEmail ?? null;

    const fromInvite =
      invite && (invite.role !== "wholesale_buyer" || invite.regionId)
        ? invite
        : null;

    if (!existing) {
      const isAdmin = adminEmail === email;
      const role = isAdmin ? "admin" : fromInvite?.role ?? "popup_customer";
      const status = isAdmin || fromInvite ? "approved" : "pending";
      const [created] = await tx
        .insert(accounts)
        .values({
          clerkUserId: user.id,
          email,
          name,
          role,
          status,
          regionId: isAdmin ? null : fromInvite?.regionId ?? null,
          approvedAt: status === "approved" ? new Date() : null,
        })
        .returning();
      if (fromInvite) {
        await tx
          .update(invitations)
          .set({ acceptedAt: new Date() })
          .where(eq(invitations.id, fromInvite.id));
      }
      return created;
    }

    if (existing.clerkUserId && existing.clerkUserId !== user.id) {
      return existing;
    }

    const patch: Partial<typeof accounts.$inferInsert> = {};
    if (!existing.clerkUserId) patch.clerkUserId = user.id;
    if (adminEmail === email && existing.role !== "admin") {
      patch.role = "admin";
      patch.status = "approved";
      patch.approvedAt = existing.approvedAt ?? new Date();
    } else if (existing.status === "pending" && fromInvite) {
      patch.role = fromInvite.role;
      patch.status = "approved";
      patch.regionId = fromInvite.regionId;
      patch.approvedAt = new Date();
      await tx
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, fromInvite.id));
    }
    if (Object.keys(patch).length === 0) return existing;
    const [updated] = await tx
      .update(accounts)
      .set(patch)
      .where(eq(accounts.id, existing.id))
      .returning();
    return updated;
  });
}

export async function getCurrentAccount(): Promise<Account | null> {
  if (clerkConfigured()) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser();
    if (!user) return null;
    return syncClerkUser(user);
  }
  const accountId = await readDevAccountId();
  if (!accountId) return null;
  const [account] = await getDb()
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  return account ?? null;
}
