"use server";

import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { retailRegions } from "@/db/catalog";
import { getDb } from "@/db/index";
import {
  accessRequests,
  accounts,
  events,
  inventory,
  invitations,
  regions,
  selectionLineups,
  waitlistEntries,
  wholesaleApplications,
} from "@/db/schema";
import { clearDevSession, devPreviewEnabled, getCurrentAccount, setDevSession } from "@/server/auth";
import { clearGate, readGate, writeGate } from "@/server/gate";
import { dollarsToCents } from "@/server/money";
import { OrderError, cancelOrder, completeOrder, markReady, placeOrder, recordDeposit } from "@/server/orders";
import { getEventBySlug, getOrderByPickupToken } from "@/server/queries";
import { ageInZone } from "@/server/time";

function failure(error: unknown) {
  if (error instanceof OrderError) return error.message;
  if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
  return "Something went wrong. Try again.";
}

async function requireAccount() {
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  return account;
}

async function requireAdmin() {
  const account = await requireAccount();
  if (account.role !== "admin" || account.status !== "approved") redirect("/account");
  return account;
}

export async function confirmAge(_prev: { error?: string } | null, formData: FormData) {
  const regionSlug = String(formData.get("region") ?? "");
  const dob = String(formData.get("dob") ?? "");
  const region = retailRegions.find((item) => item.slug === regionSlug);
  if (!region) return { error: "Choose a region." };
  if (!process.env.APP_SECRET) return { error: "The server is missing APP_SECRET." };
  const age = ageInZone(dob, region.timeZone);
  if (age < 0) return { error: "Enter a real date of birth." };
  if (age < region.minimumAge) {
    return {
      error: `Élevé Select is ${region.minimumAge}+ in ${region.name}.`,
    };
  }
  await writeGate({
    regionSlug: region.slug,
    country: region.country,
    dob,
    confirmedAt: new Date().toISOString(),
  });
  redirect("/");
}

export async function changeRegion() {
  await clearGate();
  redirect("/");
}

export async function devSignIn(formData: FormData) {
  if (!devPreviewEnabled()) redirect("/sign-in");
  const accountId = String(formData.get("accountId") ?? "");
  const [account] = await getDb()
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) redirect("/sign-in");
  await setDevSession(account.id);
  redirect("/account");
}

export async function signOut() {
  await clearDevSession();
  redirect("/");
}

export async function requestAccess(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const city = String(formData.get("city") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (name.length < 2 || !email.includes("@") || city.length < 2 || !channel) {
    return { error: "Name, email, city, and a way to reach you are required." };
  }
  await getDb().insert(accessRequests).values({
    name,
    email,
    city,
    channel,
    phone: phone || null,
    note: note || null,
  });
  return { ok: true };
}

export async function placePreorder(_prev: { error?: string } | null, formData: FormData) {
  try {
    const account = await requireAccount();
    const gate = await readGate();
    if (!gate) return { error: "Confirm your age and region first." };
    const slug = String(formData.get("event") ?? "");
    const eventRow = await getEventBySlug(slug);
    if (!eventRow) return { error: "This drop does not exist." };
    if (eventRow.region.slug !== gate.regionSlug) {
      return { error: "This drop is outside the region you entered with." };
    }
    const lines: { productId: string; quantity: number; regionId: string }[] = [];
    for (const value of formData.getAll("selection")) {
      lines.push({ productId: String(value), quantity: 1, regionId: eventRow.region.id });
    }
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("jar:")) continue;
      const quantity = Number(value);
      if (!quantity) continue;
      lines.push({
        productId: key.slice(4),
        quantity,
        regionId: eventRow.region.id,
      });
    }
    const order = await placeOrder({
      accountId: account.id,
      kind: "preorder",
      eventId: eventRow.event.id,
      lines,
      notes: String(formData.get("notes") ?? ""),
    });
    redirect(`/orders/${order.id}`);
  } catch (error) {
    const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;
    return { error: failure(error) };
  }
}

export async function placeWholesale(_prev: { error?: string } | null, formData: FormData) {
  try {
    const account = await requireAccount();
    if (!account.regionId) return { error: "This account is not locked to a region." };
    const lines: { productId: string; quantity: number; regionId: string }[] = [];
    const sets = Number(formData.get("sets") ?? 0);
    const setId = String(formData.get("setId") ?? "");
    if (sets > 0 && setId) {
      lines.push({ productId: setId, quantity: sets, regionId: account.regionId });
    }
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("jar:")) continue;
      const quantity = Number(value);
      if (!quantity) continue;
      lines.push({ productId: key.slice(4), quantity, regionId: account.regionId });
    }
    const order = await placeOrder({
      accountId: account.id,
      kind: "wholesale",
      lines,
      notes: String(formData.get("notes") ?? ""),
    });
    redirect(`/orders/${order.id}`);
  } catch (error) {
    const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;
    return { error: failure(error) };
  }
}

export async function applyWholesale(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const account = await requireAccount();
  if (account.role === "wholesale_buyer") {
    return { error: "This account is already a wholesale buyer." };
  }
  if (account.status !== "approved" && account.role !== "admin") {
    return { error: "Cole approves the account before a wholesale application." };
  }
  const businessName = String(formData.get("businessName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const requestedRegionId = String(formData.get("regionId") ?? "");
  const licenseNumber = String(formData.get("licenseNumber") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (businessName.length < 2 || contactName.length < 2 || phone.length < 7) {
    return { error: "Business, contact, and phone are required." };
  }
  const [region] = await getDb()
    .select()
    .from(regions)
    .where(and(eq(regions.id, requestedRegionId), eq(regions.channel, "wholesale")))
    .limit(1);
  if (!region) return { error: "Choose one of the three Ontario regions." };
  const [open] = await getDb()
    .select()
    .from(wholesaleApplications)
    .where(and(eq(wholesaleApplications.accountId, account.id), eq(wholesaleApplications.status, "pending")))
    .limit(1);
  if (open) return { error: "An application is already waiting." };
  await getDb().insert(wholesaleApplications).values({
    accountId: account.id,
    businessName,
    contactName,
    phone,
    requestedRegionId: region.id,
    licenseNumber: licenseNumber || null,
    note: note || null,
  });
  if (account.role === "popup_customer") {
    await getDb()
      .update(accounts)
      .set({ role: "wholesale_applicant" })
      .where(eq(accounts.id, account.id));
  }
  revalidatePath("/account");
  return { ok: true };
}

export async function approvePopup(formData: FormData) {
  await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  await getDb()
    .update(accounts)
    .set({ role: "popup_customer", status: "approved", approvedAt: new Date(), regionId: null })
    .where(eq(accounts.id, accountId));
  revalidatePath("/admin/approvals");
}

export async function suspendAccount(formData: FormData) {
  await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  await getDb().update(accounts).set({ status: "suspended" }).where(eq(accounts.id, accountId));
  revalidatePath("/admin/approvals");
}

export async function reviewRequest(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await getDb().update(accessRequests).set({ reviewedAt: new Date() }).where(eq(accessRequests.id, id));
  revalidatePath("/admin/approvals");
}

export async function decideApplication(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const regionId = String(formData.get("regionId") ?? "");
  const [application] = await getDb()
    .select()
    .from(wholesaleApplications)
    .where(eq(wholesaleApplications.id, id))
    .limit(1);
  if (!application || application.status !== "pending") return;
  if (decision === "declined") {
    await getDb()
      .update(wholesaleApplications)
      .set({ status: "declined", decidedAt: new Date(), decidedBy: admin.id })
      .where(eq(wholesaleApplications.id, id));
    revalidatePath("/admin/approvals");
    return;
  }
  const [region] = await getDb()
    .select()
    .from(regions)
    .where(and(eq(regions.id, regionId), eq(regions.channel, "wholesale")))
    .limit(1);
  if (!region) return;
  await getDb().transaction(async (tx) => {
    await tx
      .update(wholesaleApplications)
      .set({ status: "approved", decidedAt: new Date(), decidedBy: admin.id })
      .where(eq(wholesaleApplications.id, id));
    await tx
      .update(accounts)
      .set({
        role: "wholesale_buyer",
        status: "approved",
        regionId: region.id,
        approvedAt: new Date(),
      })
      .where(eq(accounts.id, application.accountId));
  });
  revalidatePath("/admin/approvals");
}

export async function createInvite(formData: FormData) {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  const regionId = String(formData.get("regionId") ?? "") || null;
  if (!email.includes("@")) return;
  if (role !== "popup_customer" && role !== "wholesale_buyer" && role !== "wholesale_applicant") return;
  if (role === "wholesale_buyer") {
    const [region] = regionId
      ? await getDb()
          .select()
          .from(regions)
          .where(and(eq(regions.id, regionId), eq(regions.channel, "wholesale")))
          .limit(1)
      : [];
    if (!region) return;
  }
  const token = randomBytes(18).toString("base64url");
  await getDb().insert(invitations).values({
    email,
    role: role as "popup_customer" | "wholesale_buyer" | "wholesale_applicant",
    regionId: role === "wholesale_buyer" ? regionId : null,
    token,
    invitedBy: admin.id,
  });
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${origin}/invite/${token}`,
        ignoreExisting: true,
      });
    } catch {
      // The in-app invite link still works if Clerk cannot send mail yet.
    }
  }
  revalidatePath("/admin/approvals");
}

export async function saveEvent(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  const regionId = String(formData.get("regionId") ?? "");
  const city = String(formData.get("city") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const preorderOpensAt = String(formData.get("preorderOpensAt") ?? "");
  const preorderClosesAt = String(formData.get("preorderClosesAt") ?? "");
  const [region] = await getDb()
    .select()
    .from(regions)
    .where(and(eq(regions.id, regionId), eq(regions.channel, "retail")))
    .limit(1);
  if (!region || !name || !slug || !city || !venue || !summary) return;
  const start = zonedToUtc(startsAt, region.timeZone);
  const end = zonedToUtc(endsAt, region.timeZone);
  const open = zonedToUtc(preorderOpensAt, region.timeZone);
  const close = zonedToUtc(preorderClosesAt, region.timeZone);
  if (![start, end, open, close].every((date) => date && !Number.isNaN(date.getTime()))) return;
  await getDb().insert(events).values({
    name,
    slug,
    regionId: region.id,
    city,
    venue,
    summary,
    timeZone: region.timeZone,
    startsAt: start!,
    endsAt: end!,
    preorderOpensAt: open!,
    preorderClosesAt: close!,
    complianceConfirmed: false,
  });
  revalidatePath("/admin/events");
  redirect(`/events/${slug}`);
}

export async function setCompliance(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const confirmed = formData.get("confirmed") === "yes";
  const note = String(formData.get("note") ?? "").trim();
  await getDb()
    .update(events)
    .set({
      complianceConfirmed: confirmed,
      complianceConfirmedAt: confirmed ? new Date() : null,
      complianceNote: note || null,
    })
    .where(eq(events.id, id));
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

export async function saveInventory(formData: FormData) {
  await requireAdmin();
  const db = getDb();
  const rows = await db.select().from(inventory);
  for (const row of rows) {
    const raw = formData.get(`onHand:${row.id}`);
    if (raw == null || raw === "") continue;
    const onHand = Number(raw);
    if (!Number.isInteger(onHand) || onHand < row.reserved) continue;
    await db.update(inventory).set({ onHand }).where(eq(inventory.id, row.id));
  }
  revalidatePath("/admin/inventory");
}

export async function adminRecordDeposit(formData: FormData) {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const amountCents = dollarsToCents(formData.get("amount"));
  if (!amountCents) return;
  try {
    await recordDeposit({
      orderId,
      amountCents,
      note: String(formData.get("note") ?? ""),
      recordedBy: admin.id,
    });
  } catch {
    return;
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
}

export async function adminOrderStatus(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  try {
    if (status === "cancel") await cancelOrder(orderId);
    if (status === "ready") await markReady(orderId);
    if (status === "complete") await completeOrder(orderId);
  } catch {
    return;
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
}

export async function joinWaitlist(formData: FormData) {
  const account = await requireAccount();
  if (account.status !== "approved") return;
  const slug = String(formData.get("event") ?? "");
  const row = await getEventBySlug(slug);
  const gate = await readGate();
  if (!row || gate?.regionSlug !== row.region.slug) return;
  await getDb()
    .insert(waitlistEntries)
    .values({ eventId: row.event.id, accountId: account.id })
    .onConflictDoNothing();
  revalidatePath(`/events/${slug}`);
}

export async function saveLineups(formData: FormData) {
  await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const db = getDb();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("lineup:")) continue;
    const lineup = String(value).trim();
    await db
      .insert(selectionLineups)
      .values({ eventId, productId: key.slice("lineup:".length), lineup })
      .onConflictDoUpdate({
        target: [selectionLineups.eventId, selectionLineups.productId],
        set: { lineup },
      });
  }
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

export async function setPaymentTerms(formData: FormData) {
  await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "");
  const terms = String(formData.get("terms") ?? "");
  if (terms !== "deposit" && terms !== "net_15" && terms !== "net_30") return;
  await getDb().update(accounts).set({ paymentTerms: terms }).where(eq(accounts.id, accountId));
  revalidatePath("/admin/approvals");
  revalidatePath("/wholesale/order");
}

export async function checkInPickup(formData: FormData) {
  const admin = await requireAdmin();
  const raw = String(formData.get("token") ?? "").trim();
  const token = decodeURIComponent(raw.includes("/pickup/") ? (raw.split("/pickup/").pop() ?? "") : raw).split(/[?#]/)[0];
  if (!token) redirect("/admin/pickup?missing=1");
  const detail = await getOrderByPickupToken(token);
  if (!detail || detail.order.status === "cancelled") redirect("/admin/pickup?missing=1");
  if (detail.order.status !== "completed") {
    if (detail.order.balanceCents > 0) {
      await recordDeposit({
        orderId: detail.order.id,
        amountCents: detail.order.balanceCents,
        note: "Collected at pickup",
        recordedBy: admin.id,
      });
    }
    try {
      await markReady(detail.order.id);
    } catch {
      // Already ready, or the deposit just moved it forward.
    }
    try {
      await completeOrder(detail.order.id);
    } catch {
      // Already checked in.
    }
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${detail.order.id}`);
  redirect(`/admin/pickup?token=${encodeURIComponent(token)}`);
}

function zonedToUtc(local: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const asUtc = new Date(`${local}:00Z`);
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(asUtc);
  const part = Object.fromEntries(formatted.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
  const hour = part.hour === "24" ? "00" : part.hour;
  const zonedAsUtc = Date.UTC(
    Number(part.year),
    Number(part.month) - 1,
    Number(part.day),
    Number(hour),
    Number(part.minute),
    Number(part.second),
  );
  const offset = zonedAsUtc - asUtc.getTime();
  return new Date(asUtc.getTime() - offset);
}
