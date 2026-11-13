import Link from "next/link";

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
        <Link href="/sign-in" className="btn mt-8">
          Sign in
        </Link>
      </main>
    );
  }

  const { SignUp } = await import("@clerk/nextjs");
  return (
    <main className="mx-auto flex max-w-6xl justify-center px-5 py-12">
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
