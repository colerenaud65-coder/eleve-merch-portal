import Link from "next/link";

import { ClaimScanner } from "@/components/claim-scanner";
import { getCurrentAccount } from "@/server/auth";

export const metadata = { title: "Claim a package", robots: { index: false } };

export default async function ClaimIndexPage() {
  const account = await getCurrentAccount();

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Collector</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">Claim</h1>
      <p className="mt-4 text-sm leading-relaxed text-mute">
        The phone camera can open the code on the package. This page does the same thing. A box is 4 units, a jar is 1,
        and every 16 units is 500 points.
      </p>
      {!account ? (
        <p className="mt-4 text-sm">
          Sign in first if the code does not send you there.{" "}
          <Link href="/sign-in?redirect_url=%2Fclaim">Sign in</Link>
        </p>
      ) : null}
      <div className="mt-8">
        <ClaimScanner />
      </div>
    </main>
  );
}
