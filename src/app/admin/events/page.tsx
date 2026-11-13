import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { products } from "@/db/schema";
import { saveEvent, saveLineups, setCompliance } from "@/server/actions";
import { listAllEvents, listLineups, listRetailRegions } from "@/server/queries";
import { formatWhen, preorderPhase } from "@/server/time";

export const metadata = { title: "Drops" };

export default async function AdminEventsPage() {
  const [rows, retail, selections] = await Promise.all([
    listAllEvents(),
    listRetailRegions(),
    getDb()
      .select()
      .from(products)
      .where(eq(products.kind, "selection"))
      .orderBy(asc(products.sortOrder)),
  ]);
  const lineupRows = await Promise.all(rows.map((row) => listLineups(row.event.id)));
  const lineupByEvent = new Map(
    rows.map((row, index) => [
      row.event.id,
      new Map(lineupRows[index]?.map((line) => [line.productId, line.lineup]) ?? []),
    ]),
  );

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
              <form action={saveLineups} className="mt-6 grid gap-3">
                <input type="hidden" name="eventId" value={event.id} />
                <p className="text-[11px] uppercase tracking-[0.16em]">Strain lineup</p>
                {selections
                  .filter((product) => product.active)
                  .map((product) => (
                    <label key={product.id}>
                      {String(product.editionNumber ?? 0).padStart(2, "0")}/16
                      <input
                        name={`lineup:${product.id}`}
                        defaultValue={lineupByEvent.get(event.id)?.get(product.id) ?? ""}
                        placeholder="Strains in this box"
                      />
                    </label>
                  ))}
                <button type="submit">Save lineup</button>
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
