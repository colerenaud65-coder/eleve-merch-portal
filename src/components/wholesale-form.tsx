"use client";

import { useActionState, useMemo, useState } from "react";

import { placeWholesale } from "@/server/actions";
import { formatMoney } from "@/server/money";

type SetItem = {
  id: string;
  name: string;
  amountCents: number;
  available: number;
};

type JarItem = {
  id: string;
  name: string;
  amountCents: number;
  available: number;
};

export function WholesaleForm({
  currency,
  setItem,
  jars,
}: {
  currency: string;
  setItem: SetItem | null;
  jars: JarItem[];
}) {
  const [state, action, pending] = useActionState(placeWholesale, null);
  const [sets, setSets] = useState(0);
  const [jarQty, setJarQty] = useState<Record<string, number>>({});
  const total = useMemo(() => {
    const setTotal = (setItem?.amountCents ?? 0) * sets;
    const jarTotal = jars.reduce((sum, jar) => sum + (jarQty[jar.id] ?? 0) * jar.amountCents, 0);
    return setTotal + jarTotal;
  }, [jarQty, jars, setItem, sets]);

  return (
    <form action={action} className="space-y-8">
      {setItem ? (
        <label>
          {setItem.name} · {formatMoney(setItem.amountCents, currency)} · {setItem.available} available
          <input type="hidden" name="setId" value={setItem.id} />
          <input
            name="sets"
            type="number"
            min={0}
            max={setItem.available}
            value={sets}
            onChange={(event) => setSets(Number(event.target.value))}
          />
        </label>
      ) : null}
      <div className="divide-y divide-ink border border-ink">
        {jars.map((jar) => (
          <div key={jar.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_7rem] sm:items-center">
            <div>
              <p>{jar.name}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                {formatMoney(jar.amountCents, currency)} · {jar.available} on hand
              </p>
            </div>
            <label className="normal-case tracking-normal">
              <span className="sr-only">Quantity for {jar.name}</span>
              <input
                name={`jar:${jar.id}`}
                type="number"
                min={0}
                max={jar.available}
                value={jarQty[jar.id] ?? 0}
                onChange={(event) =>
                  setJarQty((current) => ({ ...current, [jar.id]: Number(event.target.value) }))
                }
              />
            </label>
          </div>
        ))}
      </div>
      <label>
        Note
        <textarea name="notes" maxLength={500} />
      </label>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="font-serif text-4xl">{formatMoney(total, currency)}</p>
        <button type="submit" disabled={pending || total <= 0}>
          {pending ? "Sending" : "Place wholesale order"}
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
