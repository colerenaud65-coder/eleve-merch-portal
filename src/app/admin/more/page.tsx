import Link from "next/link";

import { DeskHeader } from "@/components/admin/desk-header";
import { funnelCounts } from "@/server/growth";
import { listRetailRegions } from "@/server/queries";

const funnelLabel: Record<string, string> = {
  view_drop: "Looked at a drop",
  start_preorder: "Started a preorder",
  preorder_placed: "Placed a preorder",
  deposit_paid: "Paid a deposit",
  picked_up: "Picked up",
};

const links = [
  ["/admin/wholesale", "Wholesale", "On-hand counts for wholesale stock."],
  ["/admin/claims", "Points & QR", "Claim codes, print sheets, and redemptions."],
  ["/admin/approvals", "People", "Collectors, wholesale applications, and invites."],
  ["/admin/contacts", "Email list", "Download the opt-in list."],
] as const;

export default async function MorePage() {
  const [funnel, regions] = await Promise.all([funnelCounts(), listRetailRegions()]);
  return (
    <>
      <DeskHeader title="More" back="/admin" detail="The tools you need less often." />
      <div className="grid gap-2">
        {links.map(([href, title, detail]) => (
          <Link key={href} href={href} className="border border-ink p-4">
            <span className="block text-sm uppercase tracking-[0.16em]">{title}</span>
            <span className="mt-2 block text-sm text-mute">{detail}</span>
          </Link>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-[11px] uppercase tracking-[0.2em]">Email list by city</h2>
        <div className="mt-3 grid gap-2">
          {regions.map((region) => (
            <a key={region.id} className="btn secondary" href={`/admin/contacts?region=${region.slug}`}>
              {region.name}
            </a>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-[11px] uppercase tracking-[0.2em]">Activity</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {funnel.map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-4 py-3">
              <span>{funnelLabel[row.name] ?? row.name}</span>
              <span>{row.total}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
