import Link from "next/link";

import { ConfirmSubmit, SubmitButton } from "@/components/admin/confirm-submit";
import { DeskHeader } from "@/components/admin/desk-header";
import { adminOrderStatus, adminRecordDeposit } from "@/server/actions";
import { orderChip } from "@/server/desk";
import { termsLabel } from "@/lib/labels";
import { formatMoney } from "@/server/money";
import { listAllEvents, listAllOrders } from "@/server/queries";
import { formatWhen } from "@/server/time";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const events = await listAllEvents();
  const selected = events.find((row) => row.event.slug === event);
  const rows = await listAllOrders(selected?.event.id);

  return (
    <main>
      <DeskHeader title="Orders" back="/admin" />
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.14em]">
        <Link href="/admin/orders" className={selected ? "text-mute" : "underline"}>
          All
        </Link>
        {events.map((row) => (
          <Link
            key={row.event.id}
            href={`/admin/orders?event=${row.event.slug}`}
            className={row.event.id === selected?.event.id ? "underline" : "text-mute"}
          >
            {row.event.name}
          </Link>
        ))}
      </nav>
      <div className="mt-6 space-y-6">
        {rows.length === 0 ? <p className="text-sm text-mute">No orders yet.</p> : null}
        {rows.map(({ order, region, account, event }) => (
          <article key={order.id} className="border border-ink p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <Link href={`/orders/${order.id}`} className="font-serif text-3xl">
                  {order.number}
                </Link>
                <p className="text-sm text-mute">
                  {account.name} · {region.name}
                  {event ? ` · ${event.name}` : ""} · {order.transferReference} ·{" "}
                  {termsLabel[order.paymentTerms] ?? order.paymentTerms}
                  {order.holdExpiresAt && order.depositReceivedCents < order.depositRequiredCents
                    ? ` · hold until ${formatWhen(order.holdExpiresAt, event?.timeZone ?? region.timeZone)}`
                    : ""}
                </p>
              </div>
              <p className="border border-ink px-2 py-2 text-[10px] uppercase tracking-[0.14em]">{orderChip(order.status)}</p>
            </div>
            <p className="mt-3 text-sm">
              {formatMoney(order.depositReceivedCents, order.currency)} received ·{" "}
              {formatMoney(order.balanceCents, order.currency)} balance
            </p>
            {order.status !== "cancelled" && order.status !== "completed" ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={adminRecordDeposit} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <label>
                    Deposit received
                    <input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" />
                  </label>
                  <SubmitButton>Record</SubmitButton>
                </form>
                <form action={adminOrderStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <SubmitButton className="secondary" name="status" value="ready">
                    Ready
                  </SubmitButton>
                </form>
                <form action={adminOrderStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <SubmitButton className="secondary" name="status" value="complete">
                    Picked up
                  </SubmitButton>
                </form>
                <form action={adminOrderStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <ConfirmSubmit className="secondary" name="status" value="cancel" label="Cancel" message="Cancel this order? A completed pickup stays on the books." />
                </form>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
