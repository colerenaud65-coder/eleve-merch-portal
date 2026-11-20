"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";

export function SubmitButton({
  children,
  pendingLabel = "Working…",
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} name={name} value={value} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ConfirmSubmit({
  label,
  message,
  className,
  name,
  value,
  pendingLabel = "Working…",
}: {
  label: string;
  message: string;
  className?: string;
  name?: string;
  value?: string;
  pendingLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending } = useFormStatus();

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm border border-ink bg-paper p-5 text-ink">
            <p className="text-sm leading-relaxed">{message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" name={name} value={value} disabled={pending}>
                {pending ? pendingLabel : "Yes, do it"}
              </button>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                Back
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
