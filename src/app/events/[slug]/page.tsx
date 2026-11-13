import Link from "next/link";
import { notFound } from "next/navigation";

import { Countdown } from "@/components/countdown";
import { JAR_SPEC, SELECTION_SPEC } from "@/db/catalog";
import { joinWaitlist } from "@/server/actions";
import { getCurrentAccount } from "@/server/auth";
import { readGate } from "@/server/gate";
import { formatMoney } from "@/server/money";
import { accountOnWaitlist, getDropOffer, getEventBySlug, waitlistForEvent } from "@/server/queries";
import { formatWhen, preorderPhase } from "@/server/time";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getEventBySlug(slug);
  return { title: row?.event.name ?? "Drop" };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getEventBySlug(slug);
  if (!row) notFound();
  const gate = await readGate();
  const inRegion = gate?.regionSlug === row.region.slug;
  const account = await getCurrentAccount().catch(() => null);
  const phase = preorderPhase(row.event);
  const canSeeMenu =
    inRegion &&
    row.region.enabled &&
    !row.event.cancelled &&
    account?.status === "approved" &&
    (account.role === "popup_customer" || account.role === "admin");
  const offer = canSeeMenu ? await getDropOffer(row.event.id, row.region.id) : null;
  const named = offer?.strains.filter((strain) => strain.name.trim()) ?? [];
  const soldOut = Boolean(offer && offer.boxesAvailable < 1 && named.every((strain) => strain.jarOnHand - strain.jarReserved < 1));
  const waiting = soldOut && account ? await accountOnWaitlist(account.id, row.event.id) : null;
  const waitCount = soldOut ? (await waitlistForEvent(row.event.id)).length : 0;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">
        {row.event.city} · {row.region.currency}
      </p>
      <h1 className="mt-2 font-serif text-6xl leading-[0.9] sm:text-8xl">{row.event.name}</h1>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-mute">{row.event.summary}</p>
      <p className="mt-2 text-sm">{formatWhen(row.event.startsAt, row.event.timeZone)}</p>
      <p className="mt-1 text-sm text-mute">{row.event.venue}</p>

      <div className="mt-8 max-w-md">
        {phase === "open" ? (
          <Countdown target={row.event.preorderClosesAt.toISOString()} label="Preorders close" />
        ) : null}
        {phase === "upcoming" ? (
          <Countdown target={row.event.preorderOpensAt.toISOString()} label="Preorders open" />
        ) : null}
        {phase === "compliance" ? (
          <p className="border border-ink p-4 text-sm">
            Preorders stay closed until compliance is confirmed for this drop.
          </p>
        ) : null}
        {phase === "closed" ? <p className="text-sm">Preorders for this drop are closed.</p> : null}
      </div>

      {!inRegion ? (
        <p className="mt-10 max-w-md border border-ink p-4 text-sm">
          This drop is outside {gate?.regionName}. Change region to see it, if you are collecting there.
        </p>
      ) : null}

      {inRegion && !canSeeMenu ? (
        <div className="mt-10 max-w-md border border-ink p-4 text-sm">
          <p>The menu is closed for this account.</p>
          <p className="mt-2 text-mute">
            {account ? "Cole still has to approve access." : "Sign in after Cole invites you."}
          </p>
          <Link href={account ? "/account" : "/request-access"} className="btn mt-4">
            {account ? "Account" : "Request access"}
          </Link>
        </div>
      ) : null}

      {row.event.cancelled || !row.region.enabled ? (
        <p className="mt-10 max-w-md border border-ink p-4 text-sm">This drop is not on the menu.</p>
      ) : null}

      {canSeeMenu && offer ? (
        <>
          <h2 className="mt-10 text-[11px] uppercase tracking-[0.16em]">4-Strain Box</h2>
          <p className="mt-3 max-w-xl text-sm text-mute">{SELECTION_SPEC}</p>
          <p className="mt-3 text-sm">
            {offer.boxesAvailable} of {offer.boxOnHand} left · {formatMoney(offer.boxCents, row.region.currency)} each.
            Numbers are assigned in order, 01/16 through 16/16.
          </p>
          <p className="mt-3 text-sm">{named.map((strain) => strain.name).join(" · ") || "Lineup not posted"}</p>
          <h2 className="mt-8 text-[11px] uppercase tracking-[0.16em]">7 g jar</h2>
          <p className="mt-3 max-w-xl text-sm text-mute">{JAR_SPEC} Same four strains as the box.</p>
          <ul className="mt-3 divide-y divide-ink border-y border-ink">
            {offer.strains.map((strain) => (
              <li key={strain.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                <span>{strain.name.trim() || `Strain ${strain.position}`}</span>
                <span className="text-mute">
                  {formatMoney(offer.jarCents, row.region.currency)} · {strain.jarOnHand - strain.jarReserved} left
                </span>
              </li>
            ))}
          </ul>
          {named.length < 4 ? (
            <p className="mt-6 text-sm">The four-strain lineup is not posted yet.</p>
          ) : null}
          {phase === "open" && !soldOut && named.length === 4 ? (
            <Link href={`/events/${row.event.slug}/preorder`} className="btn mt-8">
              Preorder
            </Link>
          ) : null}
          {phase !== "open" && !soldOut ? (
            <p className="mt-8 text-sm text-mute">Preorder opens when this drop is cleared and the window starts.</p>
          ) : null}
          {soldOut ? (
            <div className="mt-8 max-w-md border border-ink p-4">
              <p className="text-sm">This drop is sold out. {waitCount} on the waitlist.</p>
              {waiting ? (
                <p className="mt-2 text-sm text-mute">You are on the list.</p>
              ) : (
                <form action={joinWaitlist} className="mt-4">
                  <input type="hidden" name="event" value={row.event.slug} />
                  <button type="submit">Join the waitlist</button>
                </form>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
