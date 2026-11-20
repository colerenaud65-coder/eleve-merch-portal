# Élevé Select

A private collector desk for numbered boxes and 7 g jars. Pop-up preorders and Ontario wholesale live in one Next.js app. Canadian and US stock never share an order.

The previous static site is archived in [`legacy/`](legacy/) and is not served. Product photographs that used to be embedded as base64 now live as files under `legacy/images/`.

## What Cole does before this can go live

The project on Vercel is `elevestorefront-wiip`. Production is [https://elevedirect.app](https://elevedirect.app). Deploys come from `main`. Do these in order.

1. **Vercel Pro.** Confirm the project is on Pro. The public site cannot sit behind a login wall.
2. **Turn off Vercel Authentication on production** if Deployment Protection is on. Otherwise anonymous visitors never reach the age gate. In the project: Settings → Deployment Protection → set Production to off (or only protect Preview).
3. **Neon Postgres, from the Vercel Marketplace.** In the project directory, with the Vercel CLI logged in:

   ```bash
   npm i -g vercel@latest
   vercel link --project elevestorefront-wiip
   vercel integration add neon
   ```

   Use the **pooled** connection string (the host contains `-pooler`) as `DATABASE_URL`. If the CLI stops for a browser confirmation, finish it in the dashboard and run `vercel env pull .env.local --yes`.

4. **Clerk, from the Vercel Marketplace.**

   ```bash
   vercel integration add clerk
   vercel env pull .env.local --yes
   ```

   That provisions `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. In the Clerk dashboard, set the sign-in URL to `/sign-in` and the sign-up URL to `/sign-up`, and allow the production domain. New accounts do not see the menu until you approve them under Admin → Approvals, or until they open an invite link you create there. You can also turn off public sign-up in Clerk and send only invites.

5. **Set the rest of the variables** on Production (and Preview, if you want preview deploys to boot). Names are listed in [`.env.example`](.env.example). Marketplace installs do not know these:

   - `APP_SECRET` — `openssl rand -base64 32`. Signs the age-gate cookie.
   - `ADMIN_EMAIL` — the inbox you use in Clerk. The first sign-in with this address becomes admin.
   - `ETRANSFER_RECIPIENT` — the real Interac address. Deposits show this on the order. There is no Stripe, Square, or PayPal.
   - `NEXT_PUBLIC_APP_URL` — the public origin, used inside pickup and claim QR codes. Production is `https://elevedirect.app`.
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/account`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/account`

   Leave `ALLOW_DEV_PREVIEW` unset on Vercel. It is ignored whenever `NODE_ENV` is production or `VERCEL_ENV` is set.

   Drop alerts use Resend. These can wait until you are ready to email the opt-in list. If `RESEND_API_KEY` is empty, the desk says “Email not connected yet” and does not send.

   - `RESEND_API_KEY` — from the Resend dashboard.
   - `ALERTS_FROM` — defaults to `Élevé Select <drops@elevedirect.app>`.
   - `ALERTS_REPLY_TO` — defaults to `elevecanna@gmail.com`.

   Add the domain `elevedirect.app` in Resend, then copy the records from that domain’s Records tab into Vercel DNS (the project domain `elevedirect.app`, not a separate DNS host). Leave the existing site records and the Clerk `clerk` and `accounts` CNAMEs in place. The exact values are generated for the domain, so paste them from Resend rather than typing them from memory.

   Resend shows one of these two sets:

   | Type | Name | Value |
   | --- | --- | --- |
   | TXT | `resend._domainkey` | The DKIM key Resend shows, starting with `p=` |
   | MX | `send` | Priority 10. Host looks like `feedback-smtp.us-east-1.amazonses.com`. Use the region Resend shows. |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` |

   Domains created in Resend after August 2026 may show CNAMEs instead of the MX and SPF pair. In that case add both CNAMEs (`send` and `rsend`) plus the same DKIM TXT. A CNAME cannot share a name with another record. If you do not already have DMARC, add a TXT on `_dmarc` with `v=DMARC1; p=none; rua=mailto:elevecanna@gmail.com`. Verification often finishes within 15 minutes. Send only after the domain shows as verified.

6. **Redeploy** after Neon and Clerk are connected. `vercel.json` sets the framework to Next.js and the build runs migrations and the seed when `DATABASE_URL` is present, then `next build`. You do not need a terminal for `db:setup`. Migration `0005_blank_slate` clears test drops, orders, claim codes, and points once, recorded as `blank_slate_2026_11`, and does not run again. The seed does not create drops, dates, orders, or strains. It keeps regions, products, prices, wholesale stock, and the admin account from `ADMIN_EMAIL`. Toronto is Sunday Service by Caked, 1196 Queen St W, Sundays 12:00–6:00 PM ET. Vancouver is Dank Club, 6416 Main St. If `DATABASE_URL` is missing, the build still succeeds and the site shows a setup screen instead of erroring.

   `npm run db:setup` remains available for a local database.

## Local development

```bash
cp .env.example .env.local
# Fill DATABASE_URL, APP_SECRET, and DEV_PREVIEW_SECRET.
# For a local Postgres without Neon:
# DATABASE_URL=postgres://eleve:eleve@localhost:5432/eleve
# ALLOW_DEV_PREVIEW=true

npm install
npm run db:setup
npm run dev
```

With Clerk keys absent and `ALLOW_DEV_PREVIEW=true`, `/sign-in` lists accounts already in the local database. The seed does not create sample people. That path does not exist in production. With Clerk keys present, sign-in is Clerk only.

```bash
npm test
npm run build
```

## Roles and stock

| Role | What they can do |
| --- | --- |
| Pop-up customer | Preorder a drop in the region they passed the age gate for, after approval |
| Wholesale applicant | Has asked for one of the three Ontario desks |
| Approved wholesale buyer | Orders only in the region locked at approval |
| Admin | Approvals, invites, compliance, inventory, deposits |

Regions carry country and currency. Products do not. A preorder takes its region from the drop. A wholesale order takes its region from the account. Any payload that names two regions is rejected.

Seeded retail prices: Toronto box $280 CAD / jar $80 CAD, Vancouver box $300 CAD / jar $85 CAD, United States box $450 USD / jar $160 USD. Ontario wholesale: selection of 16 boxes $2,600 CAD, jar $40 CAD, on Golden Horseshoe, Eastern, and Southwestern.

Pop-up preorders stay closed until the drop’s compliance flag is on and the clock is inside the window. Half the total is due by Interac e-Transfer, referenced with the order code. The balance is due at pickup. Each order has a QR code that opens its pickup page.

## Legacy archive

`legacy/` keeps the old `index.html`, `products.js`, audio, and logos. Do not route it. The plaintext gate that used to live in that page is gone; do not bring it back.
