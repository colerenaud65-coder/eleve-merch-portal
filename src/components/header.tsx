import Link from "next/link";

import { Wordmark } from "@/components/wordmark";

import { getDb } from "@/db/index";
import { regions } from "@/db/schema";
import { getCurrentAccount } from "@/server/auth";
import type { Gate } from "@/server/gate";
import { eq } from "drizzle-orm";

export async function Header({
  gate,
}: {
  gate: Gate & { regionName: string };
}) {
  let account: Awaited<ReturnType<typeof getCurrentAccount>> = null;
  let lockedRegion: string | null = null;
  try {
    account = await getCurrentAccount();
    if (account?.regionId) {
      const [region] = await getDb()
        .select({ name: regions.name })
        .from(regions)
        .where(eq(regions.id, account.regionId))
        .limit(1);
      lockedRegion = region?.name ?? null;
    }
  } catch {
    account = null;
  }

  const place =
    account?.role === "wholesale_buyer" && lockedRegion ? lockedRegion : gate.regionName;

  return (
    <header className="border-b border-ink print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <Link href="/" className="block" aria-label="Élevé Select">
          <Wordmark priority size={36} />
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.18em]">
          <Link href="/events">Drops</Link>
          <Link href="/request-access">Request</Link>
          {account?.role === "wholesale_buyer" ? <Link href="/wholesale/order">Wholesale</Link> : null}
          {account?.role === "wholesale_applicant" ? (
            <Link href="/wholesale/apply">Wholesale</Link>
          ) : null}
          {account ? <Link href="/claim">Claim</Link> : null}
          {account?.role === "admin" ? <Link href="/admin">Admin</Link> : null}
          <Link href={account ? "/account" : "/sign-in"}>{account ? "Account" : "Sign in"}</Link>
          <span className="text-mute">{place}</span>
        </nav>
      </div>
    </header>
  );
}
