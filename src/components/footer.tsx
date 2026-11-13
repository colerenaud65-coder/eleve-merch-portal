import { changeRegion } from "@/server/actions";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-[11px] uppercase tracking-[0.16em] text-mute">
        <p>Élevé Select · 19+ Canada · 21+ United States</p>
        <form action={changeRegion}>
          <button type="submit" className="secondary">
            Change region
          </button>
        </form>
      </div>
    </footer>
  );
}
