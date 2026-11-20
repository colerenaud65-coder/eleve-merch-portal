import Link from "next/link";

import { PACKAGE_LABEL, REWARDS } from "@/server/points";
import { generateClaims, cancelReward, fulfillReward } from "@/server/actions";
import { listAllEvents, listClaimCodes, listRedemptions } from "@/server/queries";
import { formatWhen } from "@/server/time";

export const metadata = { title: "Claims" };

const rewardName = Object.fromEntries(REWARDS.map((reward) => [reward.id, reward.name]));

export default async function ClaimsPage() {
  const [codes, drops, rewards] = await Promise.all([listClaimCodes(), listAllEvents(), listRedemptions()]);
  const pending = rewards.filter((row) => row.redemption.status === "pending");

  return (
    <main className="space-y-12">
      <section>
        <h1 className="font-serif text-5xl">Package claims</h1>
        <p className="mt-3 max-w-xl text-sm text-mute">
          One code per package. A box is 4 units and a jar is 1. Every 16 units adds 500 points. Merch is handed over in person.
        </p>
        <form action={generateClaims} className="mt-6 grid gap-3 sm:grid-cols-2">
          <label>
            Package
            <select name="packageKind" defaultValue="box">
              <option value="box">{PACKAGE_LABEL.box}</option>
              <option value="jar">{PACKAGE_LABEL.jar}</option>
            </select>
          </label>
          <label>
            Drop
            <select name="eventId" defaultValue="">
              <option value="">No drop</option>
              {drops.map(({ event }) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                  {event.archived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            How many
            <input name="count" type="number" min={1} max={48} defaultValue={8} required />
          </label>
          <div className="flex items-end">
            <button type="submit">Generate codes</button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em]">Codes</h2>
        {codes.length === 0 ? (
          <p className="mt-4 text-sm text-mute">No codes yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink border-y border-ink text-sm">
            {codes.map((row) => (
              <li key={row.code.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <p>{PACKAGE_LABEL[row.code.packageKind]}</p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                    {row.code.code}
                    {row.eventName ? ` · ${row.eventName}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  {row.code.claimedAt ? (
                    <>
                      <p>Claimed</p>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                        {row.claimerName ?? row.claimerEmail} · {formatWhen(row.code.claimedAt, "America/Toronto")}
                      </p>
                    </>
                  ) : (
                    <p>Unclaimed</p>
                  )}
                  <Link href={`/admin/claims/print/${row.code.batchId}`} className="text-[11px] uppercase tracking-[0.14em]">
                    Print sheet
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em]">Redemptions</h2>
        <p className="mt-3 text-sm text-mute">{pending.length} waiting for a hand-off.</p>
        {rewards.length === 0 ? (
          <p className="mt-4 text-sm text-mute">No redemption requests.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink border-y border-ink text-sm">
            {rewards.map((row) => (
              <li key={row.redemption.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p>
                    {rewardName[row.redemption.reward] ?? row.redemption.reward} · {row.redemption.points} pts
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                    {row.accountName} · {row.redemption.status} · {formatWhen(row.redemption.createdAt, "America/Toronto")}
                  </p>
                </div>
                {row.redemption.status === "pending" ? (
                  <div className="flex gap-2">
                    <form action={fulfillReward}>
                      <input type="hidden" name="id" value={row.redemption.id} />
                      <button type="submit">Fulfilled</button>
                    </form>
                    <form action={cancelReward}>
                      <input type="hidden" name="id" value={row.redemption.id} />
                      <button type="submit" className="secondary">
                        Cancel
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
