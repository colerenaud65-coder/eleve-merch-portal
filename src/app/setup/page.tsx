import { Wordmark } from "@/components/wordmark";

export const metadata = { title: "Setup" };

const checks = [
  {
    name: "DATABASE_URL",
    ready: Boolean(process.env.DATABASE_URL),
    detail: "Neon Postgres, from the Vercel Marketplace. Use the pooled connection string.",
  },
  {
    name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    ready: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    detail: "Clerk publishable key, from the Vercel Marketplace.",
  },
  {
    name: "CLERK_SECRET_KEY",
    ready: Boolean(process.env.CLERK_SECRET_KEY),
    detail: "Clerk secret key, from the Vercel Marketplace.",
  },
];

export default function SetupPage() {
  const missing = checks.filter((item) => !item.ready);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-16">
      <Wordmark size={48} />
      <p className="mt-10 text-[11px] uppercase tracking-[0.22em] text-mute">Élevé Select</p>
      <h1 className="mt-3 font-serif text-5xl leading-none">Connect the desk</h1>
      <p className="mt-4 text-sm leading-relaxed text-mute">
        The storefront is built. It stays on this screen until Neon and Clerk are connected. Nothing here
        crashes the deployment, and no orders are stored until the database is present.
      </p>
      <ul className="mt-8 divide-y divide-ink border-y border-ink">
        {checks.map((item) => (
          <li key={item.name} className="py-4">
            <p className="text-[11px] uppercase tracking-[0.16em]">
              {item.ready ? "Ready" : "Missing"} · {item.name}
            </p>
            <p className="mt-1 text-sm text-mute">{item.detail}</p>
          </li>
        ))}
      </ul>
      {missing.length === 0 ? (
        <p className="mt-6 text-sm">Neon and Clerk are set. Open the home page.</p>
      ) : (
        <p className="mt-6 text-sm">
          In the Vercel project elevestorefront-wiip, install Neon and Clerk from the Marketplace, then
          redeploy. APP_SECRET, ADMIN_EMAIL, ETRANSFER_RECIPIENT, and the public URL are already configured.
        </p>
      )}
    </main>
  );
}
