"use client";

import { useActionState } from "react";

import { confirmAge } from "@/server/actions";

const regions = [
  { slug: "toronto", label: "Toronto · 19+" },
  { slug: "vancouver", label: "Vancouver · 19+" },
  { slug: "united-states", label: "United States · 21+" },
];

export function AgeGate() {
  const [state, action, pending] = useActionState(confirmAge, null);

  return (
    <main className="flex min-h-dvh flex-col justify-between px-5 py-8 sm:px-12">
      <p className="text-[11px] uppercase tracking-[0.32em]">Élevé Select</p>
      <div className="mx-auto w-full max-w-xl py-16">
        <h1 className="font-serif text-6xl leading-[0.85] sm:text-8xl">Age and region</h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-mute">
          Nineteen and over in Canada. Twenty-one and over in the United States. The menu you see is
          the region you enter. Canadian and US stock never share an order.
        </p>
        <form action={action} className="mt-10 space-y-5">
          <label>
            Date of birth
            <input name="dob" type="date" required autoComplete="bday" />
          </label>
          <label>
            Region
            <select name="region" required defaultValue="toronto">
              {regions.map((region) => (
                <option key={region.slug} value={region.slug}>
                  {region.label}
                </option>
              ))}
            </select>
          </label>
          {state?.error ? (
            <p role="alert" className="text-sm">
              {state.error}
            </p>
          ) : null}
          <button type="submit" disabled={pending}>
            {pending ? "Checking" : "Enter"}
          </button>
        </form>
      </div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
        Deposit by e-Transfer. Balance at pickup. No card payment.
      </p>
    </main>
  );
}
