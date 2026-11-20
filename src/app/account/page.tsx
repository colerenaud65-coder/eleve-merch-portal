import Link from "next/link";

import { SignOut } from "@/components/sign-out";
import { roleLabel, orderStatusLabel, termsLabel } from "@/lib/labels";
import { requestReward, setMarketingConsent } from "@/server/actions";
import { clerkConfigured, getCurrentAccount } from "@/server/auth";
import { boxEdition, collectorBoxes, ensureReferralCode, referralCount } from "@/server/growth";
import { formatMoney } from "@/server/money";
import { REWARDS, unitsTowardNext } from "@/server/points";
import { accountApplication, listOrdersForAccount, listRedemptionsForAccount } from "@/server/queries";
import { formatWhen } from "@/server/time";
import { redirect } from "next/navigation";

export const metadata = { title: "Account", robots: { index: false } };

const rewardLabel = Object.fromEntries(REWARDS.map((reward) => [reward.id, reward.name]));

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reward?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/sign-in");
  const params = await searchParams;
  const orders = account.status === "approved" ? await listOrdersForAccount(account.id) : [];
  const application = await accountApplication(account.id);
  const code = await ensureReferralCode(account.id);
  const referrals = await referralCount(account.id);
  const boxes = await collectorBoxes(account.id);
  const claimedRewards = await listRedemptionsForAccount(account.id);
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const toward = unitsTowardNext(account.lifetimeUnits);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-mute">{account.email}</p>
      <h1 className="mt-2 font-serif text-6xl leading-none">{account.name}</h1>
      <p className="mt-4 text-sm">
        {roleLabel[account.role]} · {account.status}
        {account.role === "wholesale_buyer" ? ` · ${termsLabel[account.paymentTerms] ?? account.paymentTerms}` : ""}
      </p>

      {account.status === "pending" ? (
        <p className="mt-8 border border-ink p-4 text-sm">
          Cole has not opened this account. The menu stays closed until he approves it or the invite is
          accepted.
        </p>
      ) : null}
      {account.status === "suspended" ? (
        <p className="mt-8 border border-ink p-4 text-sm">This account is suspended.</p>
      ) : null}

      {account.role === "wholesale_buyer" ? (
        <Link href="/wholesale/order" className="btn mt-8">
          Wholesale order
        </Link>
      ) : null}
      {account.status === "approved" && account.role !== "wholesale_buyer" ? (
        <Link href="/wholesale/apply" className="btn secondary mt-8">
          Apply for wholesale
        </Link>
      ) : null}
      {account.role === "admin" ? (
        <Link href="/admin" className="btn mt-8">
          Admin
        </Link>
      ) : null}

      {application ? (
        <p className="mt-6 text-sm text-mute">
          Wholesale application for {application.region.name}: {application.application.status}.
        </p>
      ) : null}

      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Referral</h2>
      <p className="mt-4 text-sm">
        Code {code}. {referrals} {referrals === 1 ? "signup" : "signups"}. Early access to the next drop, not a discount.
      </p>
      <p className="mt-2 text-sm">
        {origin}/r/{code}
      </p>

      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Collector</h2>
      {boxes.length === 0 ? (
        <p className="mt-4 text-sm text-mute">No numbered boxes yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink border-y border-ink">
          {boxes.map((box) => (
            <li key={`${box.drop}-${box.number}`} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
              <span>{box.drop}</span>
              <span>
                {boxEdition(box.number)} · {formatWhen(box.startsAt, box.timeZone)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Points</h2>
      <p className="mt-4 text-sm">
        {account.pointsBalance} points. {toward} of 16 units toward the next 500.
      </p>
      <p className="mt-2 text-sm text-mute">
        A 4-Strain Box is 4 units. A 7 g jar is 1. Every 16 units adds 500 points. Lifetime units {account.lifetimeUnits}.
      </p>
      <Link href="/claim" className="btn secondary mt-4">
        Scan a package
      </Link>

      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Rewards</h2>
      <p className="mt-4 text-sm text-mute">
        Hat, T-shirt, and Hoodie are point rewards, handed over in person. Other merch is available at events. Nothing here is for sale online.
      </p>
      {params.reward === "requested" ? <p className="mt-3 text-sm">Request sent. Cole hands it over at the event.</p> : null}
      {params.reward && params.reward !== "requested" ? <p className="mt-3 text-sm">{params.reward}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {REWARDS.map((reward) =>
          account.pointsBalance >= reward.points && account.status === "approved" ? (
            <form key={reward.id} action={requestReward}>
              <input type="hidden" name="reward" value={reward.id} />
              <button type="submit">
                {reward.name} · {reward.points}
              </button>
            </form>
          ) : (
            <p key={reward.id} className="border border-ink px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-mute">
              {reward.name} · {reward.points}
            </p>
          ),
        )}
      </div>
      {claimedRewards.length > 0 ? (
        <ul className="mt-4 divide-y divide-ink border-y border-ink text-sm">
          {claimedRewards.map((reward) => (
            <li key={reward.id} className="flex justify-between gap-3 py-3">
              <span>{rewardLabel[reward.reward] ?? reward.reward}</span>
              <span className="text-mute">
                {reward.status} · {reward.points} pts
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Updates</h2>
      <form action={setMarketingConsent} className="mt-4 space-y-3">
        <label className="flex items-start gap-2 normal-case tracking-normal">
          <input type="checkbox" name="consent" value="yes" defaultChecked={account.marketingConsent} style={{ width: "1rem", height: "1rem" }} />
          <span>Email me when a drop opens. Off until you check this. You can turn it off here.</span>
        </label>
        {account.marketingConsentAt ? (
          <p className="text-sm text-mute">Consent recorded {formatWhen(account.marketingConsentAt, "America/Toronto")}.</p>
        ) : null}
        <button type="submit">Save</button>
      </form>

      <h2 className="mt-12 text-[11px] uppercase tracking-[0.2em]">Orders</h2>
      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-mute">No orders yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink border-y border-ink">
          {orders.map(({ order, region, event }) => (
            <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
              <div>
                <Link href={`/orders/${order.id}`} className="text-sm">
                  {order.number}
                </Link>
                <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                  {orderStatusLabel[order.status]} · {region.name}
                  {event ? ` · ${event.name}` : ""}
                </p>
                {order.kind === "wholesale" ? (
                  <Link href={`/wholesale/order?reorder=${order.id}`} className="text-[11px] uppercase tracking-[0.14em]">
                    Reorder
                  </Link>
                ) : null}
              </div>
              <span className="text-sm">
                  {formatMoney(order.subtotalCents - order.depositReceivedCents, order.currency)} outstanding
                </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <SignOut clerk={clerkConfigured()} />
      </div>
    </main>
  );
}
