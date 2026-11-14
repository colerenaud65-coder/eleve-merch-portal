"use client";

import { useActionState } from "react";

import { applyWholesale } from "@/server/actions";

export function ApplyForm({ regions }: { regions: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(applyWholesale, null);

  if (state?.ok) {
    return (
      <p className="mt-8 border border-ink p-4 text-sm" role="status">
        Application received. The desk stays closed until Cole approves a region.
      </p>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4">
      <label>
        Business
        <input name="businessName" required />
      </label>
      <label>
        Contact
        <input name="contactName" required />
      </label>
      <label>
        Phone
        <input name="phone" required autoComplete="tel" />
      </label>
      <label>
        Ontario region
        <select name="regionId" required defaultValue={regions[0]?.id}>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Licence number
        <input name="licenseNumber" />
      </label>
      <label>
        Note
        <textarea name="note" />
      </label>
      {state?.error ? (
        <p role="alert" className="text-sm">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? "Sending" : "Submit application"}
      </button>
    </form>
  );
}
