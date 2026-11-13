import Link from "next/link";

import { SignOut } from "@/components/sign-out";
import { roleLabel, orderStatusLabel } from "@/lib/labels";
import { clerkConfigured, getCurrentAccount } from "@/server/auth";
import { formatMoney } from "@/server/money";
import { accountApplication, listOrdersForAccount } from "@/server/queries";
import { redirect } from "next/navigation";

export const metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  const orders = account.status === "approved" ? await listOrdersForAccount(account.id) : [];
  const application = await accountApplication(account.id);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{account.email}</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">{account.name}</h1>
      <p className="mt-4 text-sm">
        {roleLabel[account.role]} · {account.status}
      </p>

      {account.status === "pending" ? (
        <p className="mt-8 border border-ink p-4 text-sm">
          Cole has not opened this account. The menu stays closed until he approves it or the invite is
          accepted.
        </p>
      ) : null}
      {account.status === "suspended" ? (
        <p className="mt-8 border border-ink p-4 text-sm">This account is suspended.</p>
      ) : null}

      {account.role === "wholesale_buyer" ? (
        <Link href="/wholesale/order" className="btn mt-8">
          Wholesale order
        </Link>
      ) : null}
      {account.status === "approved" && account.role !== "wholesale_buyer" ? (
        <Link href="/wholesale/apply" className="btn secondary mt-8">
          Apply for wholesale
        </Link>
      ) : null}
      {account.role === "admin" ? (
        <Link href="/admin" className="btn mt-8">
          Admin
        </Link>
      ) : null}

      {application ? (
        <p className="mt-6 text-sm text-mute">
          Wholesale application for {application.region.name}: {application.application.status}.
        </p>
      ) : null}

      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Orders</h2>
      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-mute">No orders yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink border-y border-ink">
          {orders.map(({ order, region, event }) => (
            <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
              <div>
                <Link href={`/orders/${order.id}`} className="text-sm">
                  {order.number}
                </Link>
                <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                  {orderStatusLabel[order.status]} · {region.name}
                  {event ? ` · ${event.name}` : ""}
                </p>
              </div>
              <span className="text-sm">
                  {formatMoney(order.subtotalCents - order.depositReceivedCents, order.currency)} outstanding
                </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <SignOut clerk={clerkConfigured()} />
      </div>
    </main>
  );
}
