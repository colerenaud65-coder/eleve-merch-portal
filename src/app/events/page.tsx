import Link from "next/link";

import { readGate } from "@/server/gate";
import { listEventsForRegion } from "@/server/queries";
import { formatWhen, preorderPhase } from "@/server/time";

export const metadata = { title: "Drops" };

const phaseCopy = {
  open: "Preorders open",
  upcoming: "Opens soon",
  compliance: "Compliance pending",
  closed: "Closed",
};

export default async function EventsPage() {
  const gate = await readGate();
  const drops = gate ? await listEventsForRegion(gate.regionSlug) : [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{gate?.regionName}</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">Drops</h1>
      <p className="mt-4 max-w-md text-sm text-mute">
        Only this region is on the page. Switch region from the footer if you are collecting somewhere else.
      </p>
      <ul className="mt-10 divide-y divide-ink border-y border-ink">
        {drops.map((event) => {
          const phase = preorderPhase(event);
          return (
            <li key={event.id} className="grid gap-2 py-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Link href={`/events/${event.slug}`} className="font-serif text-4xl">
                  {event.name}
                </Link>
                <p className="mt-1 text-sm text-mute">
                  {event.city} · {formatWhen(event.startsAt, event.timeZone)}
                </p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.16em]">{phaseCopy[phase]}</p>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
