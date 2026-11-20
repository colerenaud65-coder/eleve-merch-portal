import Link from "next/link";

import { setMarketingConsent } from "@/server/actions";

export function FirstDrop({
  place,
  signedIn,
  consented,
}: {
  place: string | null;
  signedIn: boolean;
  consented?: boolean;
}) {
  return (
    <div className="mt-6 max-w-md border border-ink p-4">
      <p className="font-serif text-4xl leading-none">First drop coming soon</p>
      {place ? <p className="mt-3 text-sm text-mute">{place}</p> : null}
      <p className="mt-3 text-sm">Nothing is on the menu until Cole posts a date.</p>
      {signedIn ? (
        <form action={setMarketingConsent} className="mt-4 space-y-3">
          <label className="flex items-start gap-2 normal-case tracking-normal">
            <input
              type="checkbox"
              name="consent"
              value="yes"
              defaultChecked={consented}
              style={{ width: "1rem", height: "1rem" }}
            />
            <span>Email me when a drop opens.</span>
          </label>
          <button type="submit">Save</button>
        </form>
      ) : (
        <Link href="/sign-up" className="btn mt-4">
          Email me when it opens
        </Link>
      )}
    </div>
  );
}
