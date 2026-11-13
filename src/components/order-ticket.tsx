import Image from "next/image";
import QRCode from "qrcode";

import { orderStatusLabel } from "@/lib/labels";
import { formatMoney } from "@/server/money";
import type { getOrderDetail } from "@/server/queries";

type Detail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

export async function OrderTicket({
  detail,
  showQr,
}: {
  detail: Detail;
  showQr: boolean;
}) {
  const { order, lines, region, event, account } = detail;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qr = showQr
    ? await QRCode.toDataURL(`${origin}/pickup/${order.pickupToken}`, {
        margin: 1,
        width: 320,
        color: { dark: "#121212", light: "#f3f2ef" },
      })
    : null;
  const recipient = process.env.ETRANSFER_RECIPIENT;
  const depositOutstanding = Math.max(order.depositRequiredCents - order.depositReceivedCents, 0);
  const atPickup = Math.max(order.subtotalCents - order.depositReceivedCents - depositOutstanding, 0);

  return (
    <article className="grid gap-8 border border-ink p-5 sm:p-8 lg:grid-cols-[1fr_220px]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-mute">{order.number}</p>
        <h1 className="mt-2 font-serif text-5xl leading-none">
          {orderStatusLabel[order.status] ?? order.status}
        </h1>
        <p className="mt-4 text-sm text-mute">
          {account.name} · {region.name} · {region.currency}
          {event ? ` · ${event.name}` : ""}
        </p>
        <ul className="mt-8 divide-y divide-line border-y border-ink">
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-4 py-3 text-sm">
              <span>
                {line.quantity} × {line.label}
              </span>
              <span>{formatMoney(line.unitAmountCents * line.quantity, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-6 grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt>Total</dt>
            <dd>{formatMoney(order.subtotalCents, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Deposit required</dt>
            <dd>{formatMoney(order.depositRequiredCents, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Received</dt>
            <dd>{formatMoney(order.depositReceivedCents, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Send by e-Transfer</dt>
            <dd>{formatMoney(depositOutstanding, order.currency)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Balance at pickup</dt>
            <dd>{formatMoney(atPickup, order.currency)}</dd>
          </div>
        </dl>
        {order.status !== "cancelled" && order.status !== "completed" ? (
          <div className="mt-8 border border-ink p-4">
            <p className="text-[11px] uppercase tracking-[0.18em]">Interac e-Transfer</p>
            <p className="mt-3 font-serif text-3xl tracking-wide">{order.transferReference}</p>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Send {formatMoney(depositOutstanding, order.currency)}{" "}
              {recipient ? `to ${recipient}` : "to the Interac address Cole gives you"}. Put the reference in the
              message. The balance is collected at pickup. This desk does not take card payments.
            </p>
          </div>
        ) : null}
      </div>
      {qr ? (
        <div className="border border-ink p-4">
          <Image
            src={qr}
            alt={`Pickup code for ${order.number}`}
            width={180}
            height={180}
            unoptimized
          />
          <p className="mt-3 text-[11px] uppercase tracking-[0.16em]">Show at pickup</p>
        </div>
      ) : null}
    </article>
  );
}
