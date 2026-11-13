import { redirect } from "next/navigation";

import { WholesaleForm } from "@/components/wholesale-form";
import { getCurrentAccount } from "@/server/auth";
import { wholesaleMenu } from "@/server/queries";
import { getDb } from "@/db/index";
import { regions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata = { title: "Wholesale order" };

export default async function WholesaleOrderPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  if (account.role === "admin") redirect("/admin");
  if (account.role !== "wholesale_buyer" || !account.regionId) redirect("/wholesale/apply");

  const [region] = await getDb().select().from(regions).where(eq(regions.id, account.regionId)).limit(1);
  if (!region) redirect("/account");
  const menu = await wholesaleMenu(region.id);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Locked region</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">{region.name}</h1>
      <p className="mt-4 max-w-lg text-sm text-mute">
        This account orders only here. A selection of 16 reserves every numbered box in this region.
        Deposit by e-Transfer. Balance when the order is collected.
      </p>
      <div className="mt-10">
        <WholesaleForm currency={region.currency} setItem={menu.set} jars={menu.jars} />
      </div>
    </main>
  );
}
