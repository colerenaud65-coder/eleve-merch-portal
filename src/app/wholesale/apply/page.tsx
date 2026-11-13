import { redirect } from "next/navigation";

import { ApplyForm } from "@/components/apply-form";
import { getCurrentAccount } from "@/server/auth";
import { accountApplication, listWholesaleRegions } from "@/server/queries";

export const metadata = { title: "Wholesale application" };

export default async function ApplyPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  if (account.role === "wholesale_buyer") redirect("/wholesale/order");
  const regions = await listWholesaleRegions();
  const existing = await accountApplication(account.id);

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Wholesale</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">Apply</h1>
      <p className="mt-4 text-sm leading-relaxed text-mute">
        Approval locks the account to one of three exclusive Ontario regions. The selection of 16 is
        $2,600 CAD. A single jar is $40 CAD. That stock does not mix with pop-up inventory.
      </p>
      {existing?.application.status === "pending" ? (
        <p className="mt-8 border border-ink p-4 text-sm">
          Waiting on {existing.region.name}. Cole has the application.
        </p>
      ) : (
        <ApplyForm regions={regions.map((region) => ({ id: region.id, name: region.name }))} />
      )}
    </main>
  );
}
