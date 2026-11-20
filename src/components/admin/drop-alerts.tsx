"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useToast } from "@/components/admin/shell";
import { sendDropAlert } from "@/server/alert-actions";

export type AlertKind = "drop" | "early_access";

export type AlertPreview = {
  connected: boolean;
  published: boolean;
  count: number;
  sends: { kind: AlertKind; count: number; when: string }[];
};

const label: Record<AlertKind, string> = {
  drop: "drop alert",
  early_access: "early-access reminder",
};

export function DropAlerts({ eventId, preview }: { eventId: string; preview: AlertPreview }) {
  const toast = useToast();
  const router = useRouter();
  const [state, setState] = useState(preview);
  const [ask, setAsk] = useState<AlertKind | null>(null);
  const [busy, setBusy] = useState(false);

  const prior = ask ? state.sends.find((send) => send.kind === ask) : undefined;
  const blocked = !state.connected || !state.published || state.count === 0;

  async function send(kind: AlertKind, resendConfirmed: boolean) {
    setBusy(true);
    const result = await sendDropAlert(eventId, kind, resendConfirmed);
    setBusy(false);
    setAsk(null);
    if (!result.ok) {
      if (result.preview) setState(result.preview);
      toast({ tone: "bad", text: result.error });
      router.refresh();
      return;
    }
    setState(result.preview);
    router.refresh();
    toast({
      tone: "ok",
      text: result.sent === 1 ? "Alert sent to 1 person." : `Alert sent to ${result.sent} people.`,
    });
  }

  return (
    <section className="grid gap-3 border border-line p-4">
      <h2 className="text-[11px] uppercase tracking-[0.2em]">Drop alert</h2>
      {!state.connected ? <p className="text-sm">Email not connected yet.</p> : null}
      {!state.published ? <p className="text-sm text-mute">Publish the drop before sending an alert.</p> : null}
      {state.published && state.count === 0 ? <p className="text-sm text-mute">Nobody on the list is waiting for this city.</p> : null}
      {state.published && state.count > 0 ? (
        <p className="text-sm text-mute">
          {state.count} {state.count === 1 ? "person" : "people"} on the list
          {state.connected ? "." : ", once email is connected."}
        </p>
      ) : null}
      <button type="button" disabled={blocked || busy} onClick={() => setAsk("drop")}>
        Send drop alert
      </button>
      <button type="button" className="secondary" disabled={blocked || busy} onClick={() => setAsk("early_access")}>
        Send early-access reminder
      </button>
      {ask ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm border border-ink bg-paper p-5">
            <p className="text-sm leading-relaxed">
              {prior
                ? `This ${label[ask]} already went out to ${prior.count} ${prior.count === 1 ? "person" : "people"} on ${prior.when}. Send it again to ${state.count}?`
                : `Send this ${label[ask]} to ${state.count} ${state.count === 1 ? "person" : "people"}?`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void send(ask, Boolean(prior))}>
                {busy ? "Sending…" : prior ? "Send again" : "Send"}
              </button>
              <button type="button" className="secondary" onClick={() => setAsk(null)}>
                Back
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
