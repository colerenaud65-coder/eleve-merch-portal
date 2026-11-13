"use client";

import { useActionState, useMemo, useState } from "react";

import { placePreorder } from "@/server/actions";
import { formatMoney } from "@/server/money";

export type PreorderItem = {
  id: string;
  name: string;
  kind: "selection" | "jar";
  editionNumber: number | null;
  subtitle: string;
  amountCents: number;
  available: number;
  imagePath: string | null;
};

export function PreorderForm({
  eventSlug,
  currency,
  selections,
  jars,
}: {
  eventSlug: string;
  currency: string;
  selections: PreorderItem[];
  jars: PreorderItem[];
}) {
  const [state, action, pending] = useActionState(placePreorder, null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [jarQty, setJarQty] = useState<Record<string, number>>({});

  const total = useMemo(() => {
    const boxes = selections.reduce(
      (sum, item) => sum + (chosen[item.id] ? item.amountCents : 0),
      0,
    );
    const jarTotal = jars.reduce(
      (sum, item) => sum + (jarQty[item.id] ?? 0) * item.amountCents,
      0,
    );
    return boxes + jarTotal;
  }, [chosen, jarQty, jars, selections]);

  return (
    <form action={action} className="space-y-10">
      <input type="hidden" name="event" value={eventSlug} />
      <fieldset className="space-y-3">
        <legend className="text-[11px] uppercase tracking-[0.2em]">Numbered boxes</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {selections.map((item) => {
            const label = `${String(item.editionNumber ?? 0).padStart(2, "0")}/16`;
            const disabled = item.available < 1;
            return (
              <label
                key={item.id}
                className={`border border-ink p-3 normal-case tracking-normal ${disabled ? "opacity-40" : ""}`}
              >
                <span className="font-sans text-sm tracking-[0.18em]">{label}</span>
                <span className="mt-3 block text-sm">{item.name}</span>
                <span className="mt-1 block text-[11px] uppercase tracking-[0.14em] text-mute">
                  {item.subtitle}
                </span>
                <span className="mt-3 block text-sm">{formatMoney(item.amountCents, currency)}</span>
                <span className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
                  <input
                    className="h-4 w-4"
                    type="checkbox"
                    name="selection"
                    value={item.id}
                    disabled={disabled}
                    checked={Boolean(chosen[item.id])}
                    onChange={(event) =>
                      setChosen((current) => ({ ...current, [item.id]: event.target.checked }))
                    }
                  />
                  {disabled ? "Reserved" : "Reserve"}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[11px] uppercase tracking-[0.2em]">7 g jars</legend>
        <div className="divide-y divide-ink border border-ink">
          {jars.map((item) => (
            <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_7rem] sm:items-center">
              <div>
                <p className="text-sm">{item.name}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                  {formatMoney(item.amountCents, currency)} · {item.available} on hand
                </p>
              </div>
              <label className="normal-case tracking-normal">
                <span className="sr-only">Quantity for {item.name}</span>
                <input
                  name={`jar:${item.id}`}
                  type="number"
                  min={0}
                  max={item.available}
                  inputMode="numeric"
                  value={jarQty[item.id] ?? 0}
                  onChange={(event) =>
                    setJarQty((current) => ({
                      ...current,
                      [item.id]: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <label>
        Note for pickup
        <textarea name="notes" maxLength={500} placeholder="Optional" />
      </label>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-ink pt-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Order</p>
          <p className="font-serif text-4xl">{formatMoney(total, currency)}</p>
          <p className="mt-1 text-sm text-mute">
            Half by e-Transfer. The rest at pickup. {formatMoney(Math.round(total / 2), currency)} deposit.
          </p>
        </div>
        <button type="submit" disabled={pending || total <= 0}>
          {pending ? "Reserving" : "Place preorder"}
        </button>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
