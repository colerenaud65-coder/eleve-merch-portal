import Link from "next/link";

import { saveInventory } from "@/server/actions";
import { listInventory, listRetailRegions, listWholesaleRegions } from "@/server/queries";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region: regionSlug } = await searchParams;
  const regions = [...(await listRetailRegions()), ...(await listWholesaleRegions())];
  const selected = regions.find((region) => region.slug === regionSlug) ?? regions[0];
  const rows = selected ? await listInventory(selected.id) : [];

  return (
    <main>
      <h1 className="font-serif text-5xl">Inventory</h1>
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.14em]">
        {regions.map((region) => (
          <Link
            key={region.id}
            href={`/admin/inventory?region=${region.slug}`}
            className={region.id === selected?.id ? "underline" : "text-mute"}
          >
            {region.name}
          </Link>
        ))}
      </nav>
      <form action={saveInventory} className="mt-6">
        <div className="divide-y divide-line border-y border-ink">
          {rows.map((row) => (
            <div key={row.inventory.id} className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_8rem]">
              <div>
                <p className="text-sm">
                  {row.product.editionNumber
                    ? `${String(row.product.editionNumber).padStart(2, "0")}/16 · `
                    : ""}
                  {row.product.name}
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
    </main>
  );
}
