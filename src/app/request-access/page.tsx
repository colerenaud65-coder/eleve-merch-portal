"use client";

import { useActionState } from "react";

import { requestAccess } from "@/server/actions";

export default function RequestAccessPage() {
  const [state, action, pending] = useActionState(requestAccess, null);

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Access</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">Ask Cole</h1>
      <p className="mt-4 text-sm leading-relaxed text-mute">
        The menu stays closed until he approves the account or sends an invite. You can also reach him
        directly.
      </p>
      <ul className="mt-6 space-y-1 text-sm">
        <li>Signal · muskokasmoke.01</li>
        <li>Telegram · @Bay_Area_exotics</li>
        <li>WhatsApp · +1 (249) 358-1049</li>
      </ul>
      {state?.ok ? (
        <p className="mt-10 border border-ink p-4 text-sm" role="status">
          Received. Cole will open the account or send an invite.
        </p>
      ) : (
        <form action={action} className="mt-10 space-y-4">
          <label>
            Name
            <input name="name" required autoComplete="name" />
          </label>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            City
            <input name="city" required />
          </label>
          <label>
            Reach you on
            <select name="channel" required defaultValue="Signal">
              <option>Signal</option>
              <option>Telegram</option>
              <option>WhatsApp</option>
            </select>
          </label>
          <label>
            Phone or handle
            <input name="phone" autoComplete="tel" />
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
            {pending ? "Sending" : "Send request"}
          </button>
        </form>
      )}
    </main>
  );
}
