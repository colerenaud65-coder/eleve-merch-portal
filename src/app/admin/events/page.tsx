import { asc } from "drizzle-orm";

import { getDb } from "@/db/index";
import { dropStrains, type EventRow } from "@/db/schema";
import { saveDrop, saveEvent, saveInventory, setCompliance, setDropArchived } from "@/server/actions";
import { listAllEvents, listInventory, listRetailRegions, listWholesaleRegions } from "@/server/queries";
import { formatLocalInput, formatWhen, preorderPhase } from "@/server/time";

export const metadata = { title: "Drops" };

type Strain = {
  eventId: string;
  position: number;
  name: string;
  jarOnHand: number;
  jarReserved: number;
};

function DropCard({
  event,
  regionName,
  strains,
}: {
  event: EventRow;
  regionName: string;
  strains: Strain[];
}) {
  return (
    <article className="border border-ink p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-3xl">{event.name}</p>
          <p className="text-sm text-mute">
            {regionName} · {formatWhen(event.startsAt, event.timeZone)} · {preorderPhase(event)}
            {event.archived ? " · Archived" : ""}
          </p>
        </div>
        <form action={setDropArchived}>
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="archived" value={event.archived ? "no" : "yes"} />
          <button type="submit" className="secondary">
            {event.archived ? "Unarchive" : "Archive"}
          </button>
        </form>
      </div>
      <form action={setCompliance} className="mt-4 grid gap-3">
        <input type="hidden" name="id" value={event.id} />
        <label>
          Compliance note
          <input name="note" defaultValue={event.complianceNote ?? ""} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="confirmed" value="yes">
            Confirm compliance
          </button>
          <button type="submit" name="confirmed" value="no" className="secondary">
            Clear flag
          </button>
        </div>
      </form>
      <form action={saveDrop} className="mt-6 grid gap-6">
        <input type="hidden" name="eventId" value={event.id} />
        <fieldset className="grid gap-3">
          <legend className="text-[11px] uppercase tracking-[0.16em]">4-Strain Box</legend>
          <p className="text-sm text-mute">7 g of each strain, 28 g total.</p>
          <label>
            Box quantity
            <input name="boxOnHand" type="number" min={event.boxReserved} max={16} defaultValue={event.boxOnHand} />
          </label>
          <label>
            Early access opens
            <input
              name="earlyAccessOpensAt"
              type="datetime-local"
              defaultValue={formatLocalInput(
                event.earlyAccessOpensAt ?? new Date(event.preorderOpensAt.getTime() - 3 * 60 * 60 * 1000),
                event.timeZone,
              )}
            />
          </label>
          {[1, 2, 3, 4].map((position) => {
            const strain = strains.find((row) => row.eventId === event.id && row.position === position);
            return (
              <label key={position}>
                Strain {position}
                <input name={`strain:${position}`} defaultValue={strain?.name ?? ""} />
              </label>
            );
          })}
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-[11px] uppercase tracking-[0.16em]">7 g jar</legend>
          <p className="text-sm text-mute">Strains are copied from this drop’s box. Set quantity only.</p>
          {[1, 2, 3, 4].map((position) => {
            const strain = strains.find((row) => row.eventId === event.id && row.position === position);
            return (
              <label key={position}>
                {strain?.name.trim() || `Strain ${position}`}
                <input
                  name={`jars:${position}`}
                  type="number"
                  min={strain?.jarReserved ?? 0}
                  defaultValue={strain?.jarOnHand ?? 0}
                />
              </label>
            );
          })}
        </fieldset>
        <label className="flex items-center gap-2 normal-case tracking-normal">
          <input type="checkbox" name="cancelled" value="yes" defaultChecked={event.cancelled} />
          Cancel this week
        </label>
        <button type="submit">Save drop</button>
      </form>
    </article>
  );
}

export default async function AdminEventsPage() {
  const [rows, retail, wholesale, stock] = await Promise.all([
    listAllEvents(),
    listRetailRegions(),
    listWholesaleRegions(),
    listInventory(),
  ]);
  const wholesaleStock = stock.filter((row) => wholesale.some((region) => region.id === row.region.id));
  const strainRows = await getDb().select().from(dropStrains).orderBy(asc(dropStrains.position));
  const active = rows.filter((row) => !row.event.archived);
  const archived = rows.filter((row) => row.event.archived);

  return (
    <main className="space-y-12">
      <section>
        <h1 className="font-serif text-5xl">Drops</h1>
        {active.length === 0 ? (
          <p className="mt-6 text-sm text-mute">No drops yet. Create the first one below.</p>
        ) : null}
        <div className="mt-6 space-y-6">
          {active.map((row) => (
            <DropCard key={row.event.id} event={row.event} regionName={row.region.name} strains={strainRows} />
          ))}
        </div>
        {archived.length > 0 ? (
          <details className="mt-8 border border-ink p-4">
            <summary className="cursor-pointer text-[11px] uppercase tracking-[0.2em]">
              Archived · {archived.length}
            </summary>
            <div className="mt-6 space-y-6">
              {archived.map((row) => (
                <DropCard key={row.event.id} event={row.event} regionName={row.region.name} strains={strainRows} />
              ))}
            </div>
          </details>
        ) : null}
      </section>
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em]">New drop</h2>
        <p className="mt-2 text-sm text-mute">
          Toronto is Sunday Service by Caked, 1196 Queen St W, Sundays 12:00–6:00 PM ET. Vancouver is Dank Club,
          6416 Main St. Times you enter are local to that city: America/Toronto or America/Vancouver.
        </p>
        <form action={saveEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Slug
            <input name="slug" required placeholder="first-drop" />
          </label>
          <label>
            Region
            <select name="regionId" required defaultValue={retail[0]?.id}>
              {retail.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            City
            <input name="city" required />
          </label>
          <label className="sm:col-span-2">
            Venue note
            <input name="venue" required />
          </label>
          <label className="sm:col-span-2">
            Summary
            <textarea name="summary" required />
          </label>
          <label>
            Starts
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label>
            Ends
            <input name="endsAt" type="datetime-local" required />
          </label>
          <label>
            Preorders open
            <input name="preorderOpensAt" type="datetime-local" required />
          </label>
          <label>
            Preorders close
            <input name="preorderClosesAt" type="datetime-local" required />
          </label>
          <button type="submit">Create drop</button>
        </form>
      </section>
      {wholesaleStock.length > 0 ? (
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.2em]">Wholesale stock</h2>
          <p className="mt-2 text-sm text-mute">Pop-up boxes and jars are set on each drop above.</p>
          <form action={saveInventory} className="mt-4">
            <div className="divide-y divide-ink border-y border-ink">
              {wholesaleStock.map((row) => (
                <div key={row.inventory.id} className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_8rem]">
                  <div>
                    <p className="text-sm">
                      {row.region.name} · {row.product.name}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                      Reserved {row.inventory.reserved}
                    </p>
                  </div>
                  <label className="normal-case tracking-normal">
                    <span className="sr-only">On hand for {row.product.name}</span>
                    <input
                      name={`onHand:${row.inventory.id}`}
                      type="number"
                      min={row.inventory.reserved}
                      defaultValue={row.inventory.onHand}
                    />
                  </label>
                </div>
              ))}
            </div>
            <button type="submit" className="mt-6">
              Save counts
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
