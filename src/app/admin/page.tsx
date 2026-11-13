import Link from "next/link";

import { adminSnapshot } from "@/server/queries";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const snapshot = await adminSnapshot();
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
    </main>
  );
}
