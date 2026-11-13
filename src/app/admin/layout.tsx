import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/server/auth";

const links = [
  ["/admin", "Overview"],
  ["/admin/approvals", "Approvals"],
  ["/admin/events", "Drops"],
  ["/admin/inventory", "Inventory"],
  ["/admin/orders", "Orders"],
];

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();
  if (!account || account.role !== "admin" || account.status !== "approved") redirect("/account");

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Admin</p>
      <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.16em]">
        {links.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
