"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PickupScanner } from "@/components/pickup-scanner";
import { useToast } from "@/components/admin/shell";
import { deskCloseDrop, deskMarkDeposit, deskMarkPickedUp, deskUndoDeposit, deskUndoPickup } from "@/server/desk-actions";

export type RunOrder = {
  id: string;
  number: string;
  name: string;
  chip: string;
  money: string;
  deposit: boolean;
  pickup: boolean;
};

const chipClass: Record<string, string> = {
  "Deposit pending": "border-ink",
  "Deposit received": "bg-ink text-paper",
  Ready: "bg-ink text-paper",
  "Picked up": "border-line text-mute",
  Cancelled: "border-line text-mute line-through",
};

export function RunDesk({
  dropId,
  orders,
  stock,
  closed,
  initialQuery = "",
}: {
  dropId: string;
  orders: RunOrder[];
  stock: { label: string; left: string }[];
  closed: boolean;
  initialQuery?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [busy, setBusy] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [scanner, setScanner] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((order) => order.name.toLowerCase().includes(needle) || order.number.toLowerCase().includes(needle));
  }, [orders, query]);

  async function deposit(order: RunOrder) {
    setBusy(order.id);
    const result = await deskMarkDeposit(order.id);
    setBusy("");
    if (!result.ok) {
      toast({ tone: "bad", text: result.error });
      return;
    }
    toast({
      tone: "ok",
      text: `Deposit received for ${order.name}.`,
      undo: result.depositId
        ? async () => {
            const undone = await deskUndoDeposit(result.depositId!);
            if (!undone.ok) toast({ tone: "bad", text: undone.error });
            router.refresh();
          }
        : undefined,
    });
    router.refresh();
  }

  async function pickup(order: RunOrder) {
    setBusy(order.id);
    const result = await deskMarkPickedUp(order.id);
    setBusy("");
    if (!result.ok) {
      toast({ tone: "bad", text: result.error });
      return;
    }
    toast({
      tone: "ok",
      text: `${order.name} picked up.`,
      undo: async () => {
        const undone = await deskUndoPickup(order.id);
        if (!undone.ok) {
          toast({ tone: "bad", text: undone.error });
          return;
        }
        if (result.depositId) {
          const payment = await deskUndoDeposit(result.depositId);
          if (!payment.ok) toast({ tone: "bad", text: payment.error });
        }
        router.refresh();
      },
    });
    router.refresh();
  }

  async function closeDrop() {
    setBusy("close");
    const result = await deskCloseDrop(dropId);
    setBusy("");
    setConfirmClose(false);
    if (!result.ok) {
      toast({ tone: "bad", text: result.error });
      return;
    }
    toast({ tone: "ok", text: "Drop closed." });
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <button type="button" onClick={() => setScanner((open) => !open)}>
        {scanner ? "Hide scanner" : "Scan QR"}
      </button>
      {scanner ? <PickupScanner action="/admin/run" hidden={{ drop: dropId }} /> : null}
      <label>
        Search name or order number
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
      </label>
      <section className="grid gap-2">
        {stock.map((row) => (
          <p key={row.label} className="flex justify-between gap-4 border border-line px-3 py-3 text-sm">
            <span>{row.label}</span>
            <span>{row.left}</span>
          </p>
        ))}
      </section>
      <section className="grid gap-3">
        {visible.length === 0 ? <p className="text-sm text-mute">No orders match.</p> : null}
        {visible.map((order) => (
          <article key={order.id} className="border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-serif text-3xl leading-none">{order.name}</p>
                <p className="mt-2 text-sm text-mute">{order.number}</p>
                <p className="mt-1 text-sm">{order.money}</p>
              </div>
              <span className={`border px-2 py-2 text-[10px] uppercase tracking-[0.14em] ${chipClass[order.chip] ?? ""}`}>{order.chip}</span>
            </div>
            <div className="mt-4 grid gap-2">
              {order.deposit ? (
                <button type="button" disabled={busy === order.id} onClick={() => void deposit(order)}>
                  {busy === order.id ? "Working…" : "Mark deposit received"}
                </button>
              ) : null}
              {order.pickup ? (
                <button type="button" className="secondary" disabled={busy === order.id} onClick={() => void pickup(order)}>
                  {busy === order.id ? "Working…" : "Mark picked up"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>
      {closed ? null : (
        <button type="button" className="secondary" onClick={() => setConfirmClose(true)}>
          Close drop
        </button>
      )}
      {confirmClose ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm border border-ink bg-paper p-5">
            <p className="text-sm">Close this drop? New preorders stop. Orders already placed stay on the list.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy === "close"} onClick={() => void closeDrop()}>
                {busy === "close" ? "Closing…" : "Yes, close it"}
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmClose(false)}>
                Back
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
