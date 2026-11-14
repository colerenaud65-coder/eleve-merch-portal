"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [days, hours, minutes, seconds].map((value) => String(value).padStart(2, "0"));
}

export function Countdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const remain = now == null ? null : Math.max(0, new Date(target).getTime() - now);
  const values = remain == null ? ["—", "—", "—", "—"] : parts(remain);
  const units = ["Days", "Hours", "Min", "Sec"];

  return (
    <section aria-label={label}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-mute">{label}</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {values.map((value, index) => (
          <div key={units[index]} className="border border-ink px-1 py-3 text-center">
            <div className="font-sans text-3xl leading-none tabular-nums sm:text-4xl">{value}</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-mute">{units[index]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
