import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PreorderForm } from "@/components/preorder-form";
import { SELECTION_SPEC } from "@/db/catalog";
import { getCurrentAccount } from "@/server/auth";
import { readGate } from "@/server/gate";
import { getEventBySlug, retailMenu } from "@/server/queries";
import { preorderPhase } from "@/server/time";

export const metadata = { title: "Preorder" };

export default async function PreorderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getEventBySlug(slug);
  if (!row) notFound();
  const gate = await readGate();
  const account = await getCurrentAccount();
  if (!account) redirect(`/sign-in`);
  if (gate?.regionSlug !== row.region.slug) redirect(`/events/${slug}`);
  if (account.status !== "approved" || (account.role !== "popup_customer" && account.role !== "admin")) {
    redirect(`/events/${slug}`);
  }
  if (preorderPhase(row.event) !== "open") redirect(`/events/${slug}`);

  const menu = await retailMenu(row.region.id, row.event.id);
  const selections = menu.flatMap((item) =>
    item.kind === "selection" ? [{ ...item, kind: "selection" as const }] : [],
  );
  const jars = menu.flatMap((item) =>
    item.kind === "jar" ? [{ ...item, kind: "jar" as const }] : [],
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <Link href={`/events/${slug}`} className="text-[11px] uppercase tracking-[0.18em]">
        {row.event.name}
      </Link>
      <h1 className="mt-3 font-serif text-6xl leading-none">Preorder</h1>
      <p className="mt-4 max-w-lg text-sm text-mute">
        Each number can be held once in {row.region.name}. Prices are {row.region.currency}. Nothing on this
        order can come from another region. {SELECTION_SPEC} Unpaid boxes return to stock after 48 hours.
      </p>
      <div className="mt-10">
        <PreorderForm
          eventSlug={row.event.slug}
          currency={row.region.currency}
          selections={selections}
          jars={jars}
        />
      </div>
    </main>
  );
}
