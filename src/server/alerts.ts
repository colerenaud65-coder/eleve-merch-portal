import { randomUUID } from "node:crypto";

import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";

import { getDb } from "@/db/index";
import { accounts, dropAlerts, events } from "@/db/schema";
import { signUnsubscribe } from "@/server/unsubscribe";
import { earlyAccessAt, formatWhen } from "@/server/time";

export type AlertKind = "drop" | "early_access";

export type AlertPreview = {
  connected: boolean;
  published: boolean;
  count: number;
  sends: { kind: AlertKind; count: number; when: string }[];
};

const BATCH = 100;

export function alertsConnected() {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress() {
  return process.env.ALERTS_FROM || "Élevé Select <drops@elevedirect.app>";
}

function replyTo() {
  return process.env.ALERTS_REPLY_TO || "elevecanna@gmail.com";
}

function origin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function zoneName(date: Date, timeZone: string) {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone
  );
}

function clock(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

function day(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function recipients(regionId: string) {
  const rows = await getDb()
    .select({ id: accounts.id, email: accounts.email, name: accounts.name })
    .from(accounts)
    .where(
      and(
        eq(accounts.marketingConsent, true),
        isNotNull(accounts.marketingConsentAt),
        isNull(accounts.unsubscribedAt),
        or(isNull(accounts.marketingRegionId), eq(accounts.marketingRegionId, regionId)),
      ),
    );
  return rows.filter((row) => emailOk(row.email.trim()));
}

export async function alertPreview(eventId: string): Promise<AlertPreview | null> {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return null;
  const people = await recipients(event.regionId);
  const sends = await db
    .select()
    .from(dropAlerts)
    .where(eq(dropAlerts.eventId, eventId))
    .orderBy(desc(dropAlerts.sentAt));
  return {
    connected: alertsConnected(),
    published: event.complianceConfirmed,
    count: people.length,
    sends: sends.map((row) => ({
      kind: row.kind === "early_access" ? "early_access" : "drop",
      count: row.recipientCount,
      when: formatWhen(row.sentAt, event.timeZone),
    })),
  };
}

function message(input: {
  kind: AlertKind;
  event: typeof events.$inferSelect;
  dropUrl: string;
  unsubscribeUrl: string;
}) {
  const zone = input.event.timeZone;
  const when = `${day(input.event.startsAt, zone)}, ${clock(input.event.startsAt, zone)} to ${clock(input.event.endsAt, zone)} ${zoneName(input.event.startsAt, zone)}`;
  const early = formatWhen(earlyAccessAt(input.event), zone);
  const opens = formatWhen(input.event.preorderOpensAt, zone);
  const reply = replyTo();
  const lead =
    input.kind === "early_access"
      ? "Early access for this drop is open before the public window."
      : "A drop is posted.";
  const subject =
    input.kind === "early_access"
      ? `Early access · ${input.event.city}`
      : `Drop posted · ${input.event.city}`;
  const text = [
    "Élevé Select",
    "",
    lead,
    "",
    input.event.name,
    `${input.event.city} · ${input.event.venue}`,
    when,
    `Early access: ${early}`,
    `Preorders open: ${opens}`,
    "",
    input.dropUrl,
    "",
    "This message is for adults 19 and older. It tells you when a drop is scheduled.",
    `Élevé Select, contact ${reply}`,
    "",
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join("\n");
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:32px;background:#f3f2ef;color:#121212;font-family:Helvetica,Arial,sans-serif;">
  <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">Élevé Select</p>
  <h1 style="margin:16px 0 0;font-family:Georgia,serif;font-weight:500;font-size:32px;line-height:1;">${escapeHtml(input.event.name)}</h1>
  <p style="margin:16px 0 0;font-size:16px;line-height:1.5;">${escapeHtml(lead)}</p>
  <p style="margin:16px 0 0;font-size:16px;line-height:1.5;">${escapeHtml(input.event.city)} · ${escapeHtml(input.event.venue)}</p>
  <p style="margin:8px 0 0;font-size:16px;line-height:1.5;">${escapeHtml(when)}</p>
  <p style="margin:8px 0 0;font-size:16px;line-height:1.5;">Early access: ${escapeHtml(early)}</p>
  <p style="margin:8px 0 0;font-size:16px;line-height:1.5;">Preorders open: ${escapeHtml(opens)}</p>
  <p style="margin:24px 0 0;"><a href="${escapeHtml(input.dropUrl)}" style="color:#121212;">View the drop</a></p>
  <p style="margin:32px 0 0;font-size:12px;line-height:1.5;">This message is for adults 19 and older. It tells you when a drop is scheduled.</p>
  <p style="margin:8px 0 0;font-size:12px;line-height:1.5;">Élevé Select, contact ${escapeHtml(reply)}</p>
  <p style="margin:8px 0 0;font-size:12px;line-height:1.5;"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#121212;">Unsubscribe</a></p>
</body>
</html>`;
  return { subject, text, html };
}

async function sendBatch(payload: unknown[], idempotencyKey: string) {
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "eleve-select/1.0",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (response.ok) return null;
  const raw = await response.text();
  let detail = `The email service returned ${response.status}.`;
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed.message) detail = parsed.message;
  } catch {
    if (raw.trim()) detail = raw.trim().slice(0, 160);
  }
  return detail;
}

export async function deliverAlert(eventId: string, kind: AlertKind, sentBy: string) {
  if (!alertsConnected()) return { ok: false as const, error: "Email not connected yet." };
  if (!process.env.APP_SECRET) return { ok: false as const, error: "Email not connected yet." };
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { ok: false as const, error: "That drop is not on the list." };
  if (!event.complianceConfirmed) return { ok: false as const, error: "Publish the drop before sending an alert." };
  const people = await recipients(event.regionId);
  if (people.length === 0) return { ok: false as const, error: "Nobody on the list is waiting for this city." };
  const base = origin();
  const dropUrl = `${base}/events/${event.slug}`;
  const attempt = randomUUID();
  let sent = 0;
  let failure: string | null = null;
  for (let index = 0; index < people.length; index += BATCH) {
    const chunk = people.slice(index, index + BATCH);
    const payload = [];
    for (const person of chunk) {
      const token = signUnsubscribe(person.id);
      if (!token) {
        failure = "Email not connected yet.";
        break;
      }
      const unsubscribeUrl = `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
      const body = message({ kind, event, dropUrl, unsubscribeUrl });
      payload.push({
        from: fromAddress(),
        to: [person.email.trim()],
        reply_to: replyTo(),
        subject: body.subject,
        html: body.html,
        text: body.text,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    }
    if (failure || payload.length === 0) break;
    try {
      failure = await sendBatch(payload, `${eventId}:${kind}:${attempt}:${index / BATCH}`);
    } catch {
      failure = "The email service did not answer.";
    }
    if (failure) break;
    sent += payload.length;
  }
  if (sent > 0) {
    await db.insert(dropAlerts).values({ eventId, kind, recipientCount: sent, sentBy });
  }
  if (failure && sent === 0) return { ok: false as const, error: failure };
  if (failure) {
    return {
      ok: false as const,
      error: `Sent to ${sent} of ${people.length}. The rest did not go out. ${failure}`,
      sent,
    };
  }
  return { ok: true as const, sent };
}

export async function priorAlert(eventId: string, kind: AlertKind) {
  const [row] = await getDb()
    .select({ id: dropAlerts.id })
    .from(dropAlerts)
    .where(and(eq(dropAlerts.eventId, eventId), eq(dropAlerts.kind, kind)))
    .limit(1);
  return Boolean(row);
}
