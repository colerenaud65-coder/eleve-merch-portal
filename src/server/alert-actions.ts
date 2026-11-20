"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/server/auth";
import { alertPreview, deliverAlert, priorAlert, type AlertKind, type AlertPreview } from "@/server/alerts";

async function requireAdmin() {
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  if (account.role !== "admin" || account.status !== "approved") redirect("/account");
  return account;
}

export async function sendDropAlert(
  eventId: string,
  kind: AlertKind,
  resendConfirmed: boolean,
): Promise<
  | { ok: true; sent: number; preview: AlertPreview }
  | { ok: false; error: string; sent?: number; preview?: AlertPreview | null }
> {
  const admin = await requireAdmin();
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Email not connected yet." };
  if ((kind !== "drop" && kind !== "early_access") || !eventId) {
    return { ok: false, error: "That alert is not available." };
  }
  if ((await priorAlert(eventId, kind)) && !resendConfirmed) {
    return { ok: false, error: "This alert was already sent. Confirm to send it again." };
  }
  const result = await deliverAlert(eventId, kind, admin.id);
  revalidatePath("/admin/run");
  revalidatePath(`/admin/drops/${eventId}`);
  const sent = "sent" in result ? result.sent ?? 0 : 0;
  const preview = sent > 0 ? await alertPreview(eventId) : null;
  if (!result.ok) return { ...result, preview };
  return {
    ok: true,
    sent: result.sent,
    preview: preview ?? { connected: true, published: true, count: 0, sends: [] },
  };
}
