import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { PACKAGE_LABEL } from "@/server/points";
import { listClaimBatch } from "@/server/queries";

export const metadata = { title: "Claim sheet", robots: { index: false } };

export default async function ClaimSheetPage({ params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params;
  const rows = await listClaimBatch(batch);
  if (rows.length === 0) notFound();
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const cards = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      qr: await QRCode.toDataURL(`${origin}/claim/${row.code.code}`, {
        margin: 1,
        width: 280,
        color: { dark: "#121212", light: "#f3f2ef" },
      }),
    })),
  );
  const label = PACKAGE_LABEL[cards[0].code.packageKind];

  return (
    <main>
      <div className="no-print mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-mute">{label}</p>
          <h1 className="mt-2 font-serif text-5xl">Claim sheet</h1>
          <p className="mt-3 text-sm text-mute">{cards.length} single-use codes. Print, then stick one on each package.</p>
        </div>
        <Link href="/admin/claims" className="btn secondary">
          Back
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.code.id} className="flex items-center gap-4 border border-ink p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.qr} alt="" width={140} height={140} className="h-[140px] w-[140px]" />
            <div>
              <p className="font-serif text-3xl">{PACKAGE_LABEL[card.code.packageKind]}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-mute">{card.eventName ?? "Élevé Select"}</p>
              <p className="mt-3 break-all text-sm">{card.code.code}</p>
            </div>
          </li>
        ))}
      </ul>
      <style>{`
        @media print {
          header, footer, nav, .no-print { display: none !important; }
          main { padding: 0; }
          li { break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}
