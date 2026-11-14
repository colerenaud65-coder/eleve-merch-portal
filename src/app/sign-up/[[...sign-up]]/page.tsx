import Link from "next/link";

import { rememberMarketingConsent } from "@/server/actions";
import { clerkConfigured } from "@/server/auth";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (!clerkConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-5 py-12">
        <h1 className="font-serif text-6xl leading-none">Create account</h1>
        <p className="mt-4 text-sm leading-relaxed text-mute">
          Accounts are created in Clerk. Until those keys are set, use a local persona on the sign-in
          page. A new Clerk account still waits for Cole before the menu opens.
        </p>
        <form action={rememberMarketingConsent} className="mt-8 space-y-3">
          <label className="flex items-start gap-2 normal-case tracking-normal">
            <input type="checkbox" name="consent" value="yes" style={{ width: "1rem", height: "1rem" }} />
            <span>Email me when a drop opens. Optional, and off until you check it.</span>
          </label>
          <button type="submit" className="secondary">
            Save preference
          </button>
        </form>
        <Link href="/sign-in" className="btn mt-8">
          Sign in
        </Link>
      </main>
    );
  }

  const { SignUp } = await import("@clerk/nextjs");
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <form action={rememberMarketingConsent} className="mb-10 space-y-3">
        <label className="flex items-start gap-2 normal-case tracking-normal">
          <input type="checkbox" name="consent" value="yes" style={{ width: "1rem", height: "1rem" }} />
          <span>Email me when a drop opens. Optional, and off until you check it.</span>
        </label>
        <button type="submit" className="secondary">
          Save preference
        </button>
      </form>
      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#121212",
            colorBackground: "#f3f2ef",
            borderRadius: "0px",
          },
        }}
      />
    </main>
  );
}
