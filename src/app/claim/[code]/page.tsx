import Link from "next/link";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/next-path";
import { getCurrentAccount } from "@/server/auth";
import { claimPackage, PACKAGE_LABEL, unitsTowardNext } from "@/server/points";

export const metadata = { title: "Claim", robots: { index: false } };

export default async function ClaimCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const account = await getCurrentAccount();
  const back = safeNextPath(`/claim/${code}`, "/claim");
  if (!account) redirect(`/sign-in?redirect_url=${encodeURIComponent(back)}`);

  const result = await claimPackage(account.id, decodeURIComponent(code));

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Collector</p>
      {result.status === "invalid" ? (
        <>
          <h1 className="mt-2 font-serif text-6xl leading-none">Invalid code</h1>
          <p className="mt-4 text-sm">That code is not a package claim.</p>
        </>
      ) : null}
      {result.status === "already-claimed" ? (
        <>
          <h1 className="mt-2 font-serif text-6xl leading-none">Already claimed</h1>
          <p className="mt-4 text-sm">This code was already used. Each package can be claimed once.</p>
        </>
      ) : null}
      {result.status === "suspended" ? (
        <>
          <h1 className="mt-2 font-serif text-6xl leading-none">Account suspended</h1>
          <p className="mt-4 text-sm">This account cannot claim packages.</p>
        </>
      ) : null}
      {result.status === "already-yours" ? (
        <>
          <h1 className="mt-2 font-serif text-6xl leading-none">Already on your account</h1>
          <p className="mt-4 text-sm">{PACKAGE_LABEL[result.packageKind]} is already claimed by you.</p>
        </>
      ) : null}
      {result.status === "claimed" ? (
        <>
          <h1 className="mt-2 font-serif text-6xl leading-none">Added</h1>
          <p className="mt-4 text-sm">
            {PACKAGE_LABEL[result.packageKind]} · {result.units} {result.units === 1 ? "unit" : "units"}.
          </p>
          <p className="mt-2 text-sm">
            {result.awarded > 0 ? `${result.awarded} points added. ` : ""}
            Balance {result.balance}. {unitsTowardNext(result.lifetimeUnits)} of 16 units toward the next 500.
          </p>
        </>
      ) : null}
      <Link href="/account" className="btn mt-8">
        Account
      </Link>
    </main>
  );
}
