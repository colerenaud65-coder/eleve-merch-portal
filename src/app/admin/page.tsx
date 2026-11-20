import Link from "next/link";

import { orderStatusLabel } from "@/lib/labels";
import { funnelCounts } from "@/server/growth";
import { formatMoney } from "@/server/money";
import { adminSnapshot, listAllEvents, listAllOrders, listRetailRegions } from "@/server/queries";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const [snapshot, events, orders, funnel, retail] = await Promise.all([
    adminSnapshot(),
    listAllEvents(),
    listAllOrders(),
    funnelCounts(),
    listRetailRegions(),
  ]);
  const funnelLabel: Record<string, string> = {
    view_drop: "View drop",
    start_preorder: "Start preorder",
    preorder_placed: "Preorder placed",
    deposit_paid: "Deposit paid",
    picked_up: "Picked up",
  };
  const cards = [
    [snapshot.pendingAccounts, "Accounts waiting", "/admin/approvals"],
    [snapshot.openApplications, "Wholesale applications", "/admin/approvals"],
    [snapshot.newRequests, "Access requests", "/admin/approvals"],
    [snapshot.openOrders, "Open orders", "/admin/orders"],
  ] as const;

  return (
    <main>
      <h1 className="font-serif text-6xl leading-none">Desk</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {cards.map(([count, label, href]) => (
          <Link key={label} href={href} className="border border-ink p-5">
            <p className="font-sans text-4xl tracking-tight">{count}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.16em]">{label}</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Funnel</h2>
      <ul className="mt-4 divide-y divide-ink border-y border-ink text-sm">
        {funnel.map((step) => (
          <li key={step.name} className="flex justify-between py-3">
            <span>{funnelLabel[step.name]}</span>
            <span>{step.total}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Consented contacts</h2>
      <p className="mt-4 flex flex-wrap gap-4 text-[11px] uppercase tracking-[0.14em]">
        <a href="/admin/contacts">All regions</a>
        {retail.map((region) => (
          <a key={region.id} href={`/admin/contacts?region=${region.slug}`}>
            {region.name}
          </a>
        ))}
      </p>
      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Orders by drop</h2>
      <div className="mt-4 divide-y divide-ink border-y border-ink">
        {events.map(({ event, region }) => {
          const rows = orders.filter((row) => row.order.eventId === event.id);
          const open = rows.filter((row) => !["completed", "cancelled"].includes(row.order.status));
          const received = rows.reduce((sum, row) => sum + row.order.depositReceivedCents, 0);
          return (
            <Link key={event.id} href={`/admin/orders?event=${event.slug}`} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto]">
              <span>
                {event.name}
                <span className="mt-1 block text-[11px] uppercase tracking-[0.14em] text-mute">
                  {region.name} · {open.length} open · {rows.length} total
                  {event.archived ? " · Archived" : ""}
                </span>
              </span>
              <span className="text-sm">{formatMoney(received, region.currency)} deposited</span>
            </Link>
          );
        })}
      </div>
      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Deposit status</h2>
      <ul className="mt-4 divide-y divide-line border-y border-ink text-sm">
        {orders.slice(0, 8).map(({ order, account, event }) => (
          <li key={order.id} className="flex flex-wrap justify-between gap-2 py-3">
            <span>
              {order.number} · {account.name}
              {event ? ` · ${event.name}` : ""}
            </span>
            <span>{orderStatusLabel[order.status] ?? order.status}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
