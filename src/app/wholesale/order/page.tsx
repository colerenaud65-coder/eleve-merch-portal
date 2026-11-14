import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { WholesaleForm } from "@/components/wholesale-form";
import { getDb } from "@/db/index";
import { regions } from "@/db/schema";
import { termsLabel } from "@/lib/labels";
import { getCurrentAccount } from "@/server/auth";
import { getOrderDetail, wholesaleMenu } from "@/server/queries";

export const metadata = { title: "Wholesale order" };

export default async function WholesaleOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ reorder?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  if (account.role === "admin") redirect("/admin");
  if (account.role !== "wholesale_buyer" || !account.regionId) redirect("/wholesale/apply");

  const [region] = await getDb().select().from(regions).where(eq(regions.id, account.regionId)).limit(1);
  if (!region) redirect("/account");
  const menu = await wholesaleMenu(region.id);
  const { reorder } = await searchParams;
  let initialSets = 0;
  const initialJars: Record<string, number> = {};
  if (reorder) {
    const previous = await getOrderDetail(reorder);
    if (previous && previous.order.accountId === account.id && previous.order.kind === "wholesale") {
      for (const line of previous.lines) {
        if (menu.set && line.productId === menu.set.id) initialSets = line.quantity;
        if (menu.jars.some((jar) => jar.id === line.productId)) initialJars[line.productId] = line.quantity;
      }
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Locked region</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">{region.name}</h1>
      <p className="mt-4 max-w-lg text-sm text-mute">
        This account orders only here. Terms: {termsLabel[account.paymentTerms] ?? account.paymentTerms}. A
        selection of 16 reserves every numbered box in this region.
        {account.paymentTerms === "deposit"
          ? " Half is due by e-Transfer. Unpaid boxes return after 48 hours."
          : " The balance is due on terms. No deposit is taken."}
      </p>
      <div className="mt-10">
        <WholesaleForm
          currency={region.currency}
          setItem={menu.set}
          jars={menu.jars}
          initialSets={initialSets}
          initialJars={initialJars}
          terms={account.paymentTerms}
        />
      </div>
    </main>
  );
}
