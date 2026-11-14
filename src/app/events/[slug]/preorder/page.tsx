import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PreorderForm } from "@/components/preorder-form";
import { SELECTION_SPEC } from "@/db/catalog";
import { getCurrentAccount } from "@/server/auth";
import { readGate } from "@/server/gate";
import { hasEarlyAccess, recordFunnel } from "@/server/growth";
import { getDropOffer, getEventBySlug } from "@/server/queries";
import { preorderPhase } from "@/server/time";

export const metadata = { title: "Preorder" };

export default async function PreorderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getEventBySlug(slug);
  if (!row || row.event.cancelled || !row.region.enabled) notFound();
  const gate = await readGate();
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  if (gate?.regionSlug !== row.region.slug) redirect(`/events/${slug}`);
  if (account.status !== "approved" || (account.role !== "popup_customer" && account.role !== "admin")) {
    redirect(`/events/${slug}`);
  }
  const early = await hasEarlyAccess(account.id, account.role);
  if (preorderPhase(row.event, new Date(), early) !== "open") redirect(`/events/${slug}`);
  await recordFunnel({ name: "start_preorder", accountId: account.id, eventId: row.event.id });

  const offer = await getDropOffer(row.event.id, row.region.id);
  const strains = offer.strains
    .filter((strain) => strain.name.trim())
    .map((strain) => ({
      position: strain.position,
      name: strain.name,
      available: strain.jarOnHand - strain.jarReserved,
    }));
  if (strains.length < 4) redirect(`/events/${slug}`);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href={`/events/${slug}`} className="text-[11px] uppercase tracking-[0.18em]">
        {row.event.name}
      </Link>
      <h1 className="mt-3 font-serif text-6xl leading-none">Preorder</h1>
      <p className="mt-4 max-w-lg text-sm text-mute">
        {row.event.venue}. {SELECTION_SPEC} Unpaid boxes return to stock after 48 hours.
      </p>
      <div className="mt-10">
        <PreorderForm
          eventSlug={row.event.slug}
          currency={row.region.currency}
          boxCents={offer.boxCents}
          jarCents={offer.jarCents}
          boxesAvailable={offer.boxesAvailable}
          strains={strains}
        />
      </div>
    </main>
  );
}
