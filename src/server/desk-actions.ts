"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { events } from "@/db/schema";
import { getCurrentAccount } from "@/server/auth";
import { saveWizard, type WizardInput, type WizardResult } from "@/server/desk";
import { OrderError, completeOrder, markReady, recordDeposit, undoDeposit, undoPickup } from "@/server/orders";
import { getOrderDetail } from "@/server/queries";

async function requireAdmin() {
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  if (account.role !== "admin" || account.status !== "approved") redirect("/account");
  return account;
}

function failure(error: unknown) {
  if (error instanceof OrderError) return error.message;
  return "That did not go through. Try again.";
}

function refresh(eventId?: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/run");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/drops");
  if (eventId) revalidatePath(`/admin/drops/${eventId}`);
}

export async function saveDropWizard(input: WizardInput): Promise<WizardResult> {
  await requireAdmin();
  const result = await saveWizard(input);
  if (result.ok) {
    refresh(result.id);
    revalidatePath("/events");
    revalidatePath("/");
  }
  return result;
}

export async function deskMarkDeposit(orderId: string): Promise<{ ok: true; depositId?: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const detail = await getOrderDetail(orderId);
  if (!detail) return { ok: false, error: "That order is not on the list." };
  const due = detail.order.depositRequiredCents - detail.order.depositReceivedCents;
  if (due <= 0) return { ok: false, error: "The deposit is already in." };
  try {
    const paid = await recordDeposit({
      orderId,
      amountCents: due,
      note: "Marked received at the desk",
      recordedBy: admin.id,
    });
    refresh(detail.order.eventId);
    return { ok: true, depositId: paid.depositId };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function deskUndoDeposit(depositId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    await undoDeposit(depositId);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function deskMarkPickedUp(
  orderId: string,
): Promise<{ ok: true; depositId?: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const detail = await getOrderDetail(orderId);
  if (!detail || detail.order.status === "cancelled" || detail.order.status === "completed") {
    return { ok: false, error: "That order is not open." };
  }
  try {
    let depositId: string | undefined;
    if (detail.order.balanceCents > 0) {
      const paid = await recordDeposit({
        orderId,
        amountCents: detail.order.balanceCents,
        note: "Collected at the door",
        recordedBy: admin.id,
      });
      depositId = paid.depositId;
    }
    try {
      await markReady(orderId);
    } catch {
      // Already ready, or the door payment moved it forward.
    }
    await completeOrder(orderId);
    refresh(detail.order.eventId);
    return { ok: true, depositId };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function deskUndoPickup(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    await undoPickup(orderId);
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function deskCloseDrop(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { ok: false, error: "That drop is not on the list." };
  const now = new Date();
  await db
    .update(events)
    .set({
      endsAt: event.endsAt > now ? now : event.endsAt,
      preorderClosesAt: event.preorderClosesAt > now ? now : event.preorderClosesAt,
    })
    .where(eq(events.id, event.id));
  refresh(eventId);
  revalidatePath("/events");
  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/");
  return { ok: true };
}
