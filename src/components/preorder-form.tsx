"use client";

import { useActionState, useMemo, useState } from "react";

import { placePreorder } from "@/server/actions";
import { formatMoney } from "@/server/money";

export type DropStrain = {
  position: number;
  name: string;
  available: number;
};

export function PreorderForm({
  eventSlug,
  currency,
  boxCents,
  jarCents,
  boxesAvailable,
  strains,
}: {
  eventSlug: string;
  currency: string;
  boxCents: number;
  jarCents: number;
  boxesAvailable: number;
  strains: DropStrain[];
}) {
  const [state, action, pending] = useActionState(placePreorder, null);
  const [boxes, setBoxes] = useState(0);
  const [jars, setJars] = useState<Record<number, number>>({});
  const total = useMemo(() => {
    const jarTotal = strains.reduce((sum, strain) => sum + (jars[strain.position] ?? 0) * jarCents, 0);
    return boxes * boxCents + jarTotal;
  }, [boxes, boxCents, jarCents, jars, strains]);

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="event" value={eventSlug} />
      <fieldset className="space-y-3">
        <legend className="text-[11px] uppercase tracking-[0.2em]">4-Strain Box</legend>
        <label>
          Quantity · {formatMoney(boxCents, currency)} · {boxesAvailable} left
          <input
            name="boxes"
            type="number"
            min={0}
            max={boxesAvailable}
            value={boxes}
            onChange={(event) => setBoxes(Number(event.target.value))}
          />
        </label>
        <p className="text-sm text-mute">
          7 g of each strain, 28 g total. {strains.map((strain) => strain.name).join(" · ")}. Numbers are assigned in order.
        </p>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-[11px] uppercase tracking-[0.2em]">7 g jar</legend>
      <div className="divide-y divide-ink border border-ink">
        {strains.map((strain) => (
          <div key={strain.position} className="grid gap-3 p-4 sm:grid-cols-[1fr_7rem] sm:items-center">
            <div>
              <p>{strain.name}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                7 g jar · {formatMoney(jarCents, currency)} · {strain.available} left
              </p>
            </div>
            <label className="normal-case tracking-normal">
              <span className="sr-only">Jars of {strain.name}</span>
              <input
                name={`jar:${strain.position}`}
                type="number"
                min={0}
                max={strain.available}
                value={jars[strain.position] ?? 0}
                onChange={(event) =>
                  setJars((current) => ({ ...current, [strain.position]: Number(event.target.value) }))
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
