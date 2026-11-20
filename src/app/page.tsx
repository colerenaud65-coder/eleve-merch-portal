import Image from "next/image";
import Link from "next/link";

import { Countdown } from "@/components/countdown";
import { readGate } from "@/server/gate";
import { listEventsForRegion } from "@/server/queries";
import { formatWhen, preorderPhase } from "@/server/time";

export default async function HomePage() {
  const gate = await readGate();
  const drops = gate ? await listEventsForRegion(gate.regionSlug).catch(() => []) : [];
  const next = drops[0];
  const phase = next ? preorderPhase(next) : null;

  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:py-20">
        <div>
          <p className="text-[11px] uppercase tracking-[0.42em]">Select</p>
          <h1 className="mt-3">
            <Image
              src="/brand/wordmark-black.png"
              alt="Élevé"
              width={1323}
              height={567}
              priority
              sizes="(min-width: 640px) 560px, 90vw"
              className="h-[22vw] w-auto max-w-full sm:h-[9.5rem]"
            />
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-mute">
            A 4-strain box, 7 g of each strain, and 7 g jars of those same strains. Released at a
            pop-up, not shipped from a cart. Hats, shirts, and hoodies are point rewards. Other merch is in person at the event.
          </p>
        </div>
        <ol className="grid gap-px border border-ink bg-ink sm:grid-cols-3">
          {[
            ["01", "Request", "Write to Cole. Signal, Telegram, or the form."],
            ["02", "Approval", "An invite or an approval. Until then the menu stays shut."],
            ["03", "Drop", "Reserve a number. e-Transfer the deposit. Balance at the door."],
          ].map(([index, title, copy]) => (
            <li key={index} className="bg-paper p-5">
              <p className="font-sans text-sm tracking-[0.2em]">{index}</p>
              <h2 className="mt-4 text-[11px] uppercase tracking-[0.2em]">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-mute">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-ink">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_18rem]">
          <div>
            <h2 className="text-[11px] uppercase tracking-[0.2em]">In {gate?.regionName}</h2>
            {drops.length === 0 ? (
              <p className="mt-4 text-sm text-mute">No drop is scheduled in this region.</p>
            ) : (
              <ul className="mt-4 divide-y divide-ink border-y border-ink">
                {drops.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                    <div>
                      <Link href={`/events/${event.slug}`} className="font-serif text-3xl">
                        {event.name}
                      </Link>
                      <p className="text-sm text-mute">
                        {event.city} · {formatWhen(event.startsAt, event.timeZone)}
                      </p>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.16em]">
                      {preorderPhase(event) === "open"
                        ? "Preorders open"
                        : preorderPhase(event) === "compliance"
                          ? "Compliance pending"
                          : preorderPhase(event) === "upcoming"
                            ? "Opens soon"
                            : "Closed"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/request-access" className="btn mt-8">
              Request access
            </Link>
          </div>
          {next && (phase === "open" || phase === "upcoming") ? (
            <Countdown
              target={(phase === "open" ? next.preorderClosesAt : next.preorderOpensAt).toISOString()}
              label={phase === "open" ? `Preorders close · ${next.name}` : `Preorders open · ${next.name}`}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
