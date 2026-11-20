import { customerRetailRegions } from "@/db/catalog";
import { changeRegion } from "@/server/actions";
import { readGate } from "@/server/gate";

export async function Footer() {
  const gate = await readGate();

  return (
    <footer className="mt-auto border-t border-ink print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-[11px] uppercase tracking-[0.16em] text-mute">
        <p>Élevé Select · 19+ Canada · 21+ United States</p>
        <form action={changeRegion} className="flex flex-wrap items-center gap-2">
          <label className="normal-case tracking-normal">
            <span className="sr-only">Region</span>
            <select name="region" defaultValue={gate?.regionSlug ?? "toronto"} style={{ width: "auto" }}>
              {customerRetailRegions.map((region) => (
                <option key={region.slug} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="secondary">
            Update region
          </button>
        </form>
      </div>
    </footer>
  );
}
