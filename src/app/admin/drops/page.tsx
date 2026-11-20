import Link from "next/link";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { DeskHeader } from "@/components/admin/desk-header";
import { setDropArchived } from "@/server/actions";
import { deskStatus, deskStatusLabel } from "@/server/desk";
import { getDropOffer, listAllEvents } from "@/server/queries";
import { formatWhen } from "@/server/time";

export default async function DropsPage() {
  const events = await listAllEvents();
  const rows = await Promise.all(
    events.map(async ({ event }) => {
      const offer = await getDropOffer(event.id, event.regionId);
      const jarsLeft = offer.strains.reduce((sum, strain) => sum + Math.max(strain.jarOnHand - strain.jarReserved, 0), 0);
      return { event, status: deskStatus(event, jarsLeft) };
    }),
  );
  const open = rows.filter((row) => !row.event.archived);
  const archived = rows.filter((row) => row.event.archived);

  return (
    <>
      <DeskHeader title="Drops" back="/admin" />
      <Link href="/admin/drops/new" className="btn">
        Create drop
      </Link>
      <div className="mt-6 grid gap-3">
        {open.length === 0 ? <p className="text-sm text-mute">No drop yet.</p> : null}
        {open.map(({ event, status }) => (
          <DropRow key={event.id} event={event} status={status} />
        ))}
      </div>
      {archived.length > 0 ? (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm uppercase tracking-[0.16em]">Archive</summary>
          <div className="mt-4 grid gap-3">
            {archived.map(({ event, status }) => (
              <DropRow key={event.id} event={event} status={status} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

function DropRow({
  event,
  status,
}: {
  event: Awaited<ReturnType<typeof listAllEvents>>[number]["event"];
  status: ReturnType<typeof deskStatus>;
}) {
  return (
    <article className="border border-line p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{deskStatusLabel[status]}</p>
      <h2 className="mt-2 font-serif text-3xl leading-none">{event.name}</h2>
      <p className="mt-2 text-sm text-mute">
        {event.city} · {formatWhen(event.startsAt, event.timeZone)}
      </p>
      <div className="mt-4 grid gap-2">
        <Link href={`/admin/drops/${event.id}`} className="btn secondary">
          Edit
        </Link>
        <Link href={`/admin/drops/new?from=${event.id}`} className="btn secondary">
          Duplicate
        </Link>
        <Link href={`/admin/run?drop=${event.id}`} className="btn">
          Run
        </Link>
        <form action={setDropArchived}>
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="archived" value={event.archived ? "no" : "yes"} />
          <ConfirmSubmit
            className="secondary w-full"
            label={event.archived ? "Put back on the list" : "Archive"}
            message={
              event.archived
                ? "Show this drop on the public list again?"
                : "Hide this drop from the public list? Orders stay on the books."
            }
          />
        </form>
      </div>
    </article>
  );
}
