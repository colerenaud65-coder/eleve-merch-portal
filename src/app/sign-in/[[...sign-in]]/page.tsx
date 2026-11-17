import { clerkConfigured, devPreviewEnabled } from "@/server/auth";
import { devSignIn } from "@/server/actions";
import { listDevAccounts } from "@/server/queries";
import { roleLabel } from "@/lib/labels";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (clerkConfigured()) {
    const { SignIn } = await import("@clerk/nextjs");
    return (
      <main className="mx-auto flex max-w-6xl justify-center px-5 py-12">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/account"
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

  const accounts = devPreviewEnabled() ? await listDevAccounts().catch(() => []) : [];

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Account</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">Sign in</h1>
      {accounts.length > 0 ? (
        <>
          <p className="mt-4 text-sm leading-relaxed text-mute">
            Clerk is not configured on this machine. These seeded personas exist only for local preview
            and are ignored in production.
          </p>
          <ul className="mt-8 divide-y divide-ink border-y border-ink">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm">{account.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                    {roleLabel[account.role]} · {account.status}
                  </p>
                </div>
                <form action={devSignIn}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <button type="submit">Enter</button>
                </form>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-6 text-sm leading-relaxed text-mute">
          Sign-in is handled by Clerk. Add the publishable key and secret from the Vercel Marketplace
          integration, then reload.
        </p>
      )}
    </main>
  );
}
