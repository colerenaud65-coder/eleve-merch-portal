import Link from "next/link";

import { DeskHeader } from "@/components/admin/desk-header";
import { Countdown } from "@/components/countdown";
import { deskStatus, deskStatusLabel } from "@/server/desk";
import { formatMoney } from "@/server/money";
import { getDropOffer, listAllEvents, listAllOrders } from "@/server/queries";
import { earlyAccessAt } from "@/server/time";

const rank: Record<string, number> = { live: 0, early: 1, scheduled: 2, draft: 3, soldout: 4, ended: 5 };

export default async function AdminHome() {
  const events = (await listAllEvents()).filter((row) => !row.event.archived);
  const scored = await Promise.all(
    events.map(async ({ event }) => {
      const offer = await getDropOffer(event.id, event.regionId);
      const jarsLeft = offer.strains.reduce((sum, strain) => sum + Math.max(strain.jarOnHand - strain.jarReserved, 0), 0);
      return { event, status: deskStatus(event, jarsLeft) };
    }),
  );
  scored.sort((a, b) => {
    const byRank = rank[a.status]! - rank[b.status]!;
    if (byRank !== 0) return byRank;
    if (a.status === "ended") return b.event.startsAt.getTime() - a.event.startsAt.getTime();
    return a.event.startsAt.getTime() - b.event.startsAt.getTime();
  });
  const current = scored.find((row) => row.status !== "ended") ?? scored[0];

  if (!current) {
    return (
      <>
        <DeskHeader title="Desk" detail="No drop yet." />
        <Link href="/admin/drops/new" className="btn w-full">
          Create drop
        </Link>
      </>
    );
  }

  const { event, status } = current;
  const orders = (await listAllOrders(event.id)).filter((row) => row.order.status !== "cancelled");
  const taken = orders.reduce((sum, row) => sum + row.order.depositReceivedCents, 0);
  const target =
    status === "early" ? event.preorderOpensAt : status === "scheduled" ? earlyAccessAt(event) : status === "live" ? event.endsAt : event.startsAt;
  const currency = orders[0]?.order.currency ?? "CAD";

  return (
    <>
      <DeskHeader title="Desk" />
      <article className="border border-ink p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-mute">{deskStatusLabel[status]}</p>
        <h2 className="mt-3 font-serif text-5xl leading-none">{event.name}</h2>
        <p className="mt-3 text-sm text-mute">
          {event.city} · {event.venue}
        </p>
        {status === "ended" ? null : (
          <div className="mt-5">
            <Countdown
              target={target.toISOString()}
              label={
                status === "live"
                  ? "Until the drop ends"
                  : status === "early"
                    ? "Until everyone can order"
                    : status === "scheduled"
                      ? "Until early access"
                      : "Until the drop starts"
              }
            />
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <p className="border border-line p-3">
            <span className="block text-[11px] uppercase tracking-[0.16em] text-mute">Preorders</span>
            <span className="mt-2 block font-serif text-4xl leading-none">{orders.length}</span>
          </p>
          <p className="border border-line p-3">
            <span className="block text-[11px] uppercase tracking-[0.16em] text-mute">Deposits in</span>
            <span className="mt-2 block font-serif text-4xl leading-none">{formatMoney(taken, currency)}</span>
          </p>
        </div>
      </article>
      <div className="mt-4 grid gap-2">
        <Link href="/admin/drops/new" className="btn">
          Create drop
        </Link>
        <Link href={`/admin/run?drop=${event.id}`} className="btn">
          Run drop
        </Link>
        <Link href={`/admin/orders?event=${event.slug}`} className="btn secondary">
          Orders
        </Link>
        <Link href="/admin/wholesale" className="btn secondary">
          Wholesale
        </Link>
        <Link href="/admin/claims" className="btn secondary">
          Points & QR
        </Link>
      </div>
    </>
  );
}
