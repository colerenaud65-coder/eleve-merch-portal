import { asc } from "drizzle-orm";

import { getDb } from "@/db/index";
import { dropStrains } from "@/db/schema";
import { saveDrop, saveEvent, setCompliance } from "@/server/actions";
import { listAllEvents, listRetailRegions } from "@/server/queries";
import { formatWhen, preorderPhase } from "@/server/time";

export const metadata = { title: "Drops" };

export default async function AdminEventsPage() {
  const [rows, retail] = await Promise.all([listAllEvents(), listRetailRegions()]);
  const strainRows = await getDb().select().from(dropStrains).orderBy(asc(dropStrains.position));

  return (
    <main className="space-y-12">
      <section>
        <h1 className="font-serif text-5xl">Drops</h1>
        <div className="mt-6 space-y-6">
          {rows.map(({ event, region }) => (
            <article key={event.id} className="border border-ink p-4">
              <p className="font-serif text-3xl">{event.name}</p>
              <p className="text-sm text-mute">
                {region.name} · {formatWhen(event.startsAt, event.timeZone)} · {preorderPhase(event)}
              </p>
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
                  {[1, 2, 3, 4].map((position) => {
                    const strain = strainRows.find((row) => row.eventId === event.id && row.position === position);
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
                    const strain = strainRows.find((row) => row.eventId === event.id && row.position === position);
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
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em]">New drop</h2>
        <p className="mt-2 text-sm text-mute">Times are local to the region.</p>
        <form action={saveEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Slug
            <input name="slug" required placeholder="toronto-spring" />
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
    </main>
  );
}
