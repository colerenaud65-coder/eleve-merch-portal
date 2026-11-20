import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { DeskHeader } from "@/components/admin/desk-header";
import {
  approvePopup,
  createInvite,
  decideApplication,
  reviewRequest,
  setPaymentTerms,
  suspendAccount,
} from "@/server/actions";
import {
  listAccessRequests,
  listApplications,
  listInvitations,
  listPendingAccounts,
  listWholesaleBuyers,
  listWholesaleRegions,
} from "@/server/queries";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const [pending, requests, applications, invites, regions, buyers] = await Promise.all([
    listPendingAccounts(),
    listAccessRequests(),
    listApplications(),
    listInvitations(),
    listWholesaleRegions(),
    listWholesaleBuyers(),
  ]);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <main className="space-y-12">
      <section>
        <DeskHeader title="People" back="/admin/more" />
        <div className="mt-6 space-y-4">
          {pending.length === 0 ? <p className="text-sm text-mute">No accounts waiting.</p> : null}
          {pending.map((account) => (
            <article key={account.id} className="flex flex-wrap items-center justify-between gap-3 border border-ink p-4">
              <div>
                <p>{account.name}</p>
                <p className="text-sm text-mute">{account.email}</p>
              </div>
              <div className="flex gap-2">
                <form action={approvePopup}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <button type="submit">Approve collector</button>
                </form>
                <form action={suspendAccount}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <ConfirmSubmit className="secondary" label="Suspend" message="Suspend this account? They will not be able to order." />
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em]">Access requests</h2>
        <ul className="mt-4 divide-y divide-ink border-y border-ink">
          {requests.map((request) => (
            <li key={request.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-sm">
                  {request.name} · {request.city} · {request.channel}
                </p>
                <p className="text-sm text-mute">
                  {request.email}
                  {request.phone ? ` · ${request.phone}` : ""} {request.note ? `· ${request.note}` : ""}
                </p>
              </div>
              {request.reviewedAt ? (
                <span className="text-[11px] uppercase tracking-[0.14em] text-mute">Reviewed</span>
              ) : (
                <form action={reviewRequest}>
                  <input type="hidden" name="id" value={request.id} />
                  <button type="submit" className="secondary">
                    Mark reviewed
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em]">Wholesale applications</h2>
        <div className="mt-4 space-y-4">
          {applications.map(({ application, region, account }) => (
            <article key={application.id} className="border border-ink p-4">
              <p>
                {application.businessName} · {account.email}
              </p>
              <p className="text-sm text-mute">
                Asked for {region.name}. {application.status}.
                {application.licenseNumber ? ` Licence ${application.licenseNumber}.` : ""}
              </p>
              {application.status === "pending" ? (
                <form action={decideApplication} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="id" value={application.id} />
                  <label>
                    Lock to
                    <select name="regionId" defaultValue={region.id}>
                      {regions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" name="decision" value="approved">
                    Approve
                  </button>
                  <ConfirmSubmit name="decision" value="declined" className="secondary" label="Decline" message="Decline this wholesale application?" />
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em]">Wholesale terms</h2>
        <div className="mt-4 space-y-3">
          {buyers.map(({ account, region }) => (
            <form key={account.id} action={setPaymentTerms} className="grid gap-3 border border-ink p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
              <div>
                <p>{account.name}</p>
                <p className="text-sm text-mute">{region?.name ?? "No region"}</p>
              </div>
              <input type="hidden" name="accountId" value={account.id} />
              <label>
                Terms
                <select name="terms" defaultValue={account.paymentTerms}>
                  <option value="deposit">Deposit</option>
                  <option value="net_15">Net 15</option>
                  <option value="net_30">Net 30</option>
                </select>
              </label>
              <button type="submit">Save</button>
            </form>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em]">Invite</h2>
        <form action={createInvite} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Role
            <select name="role" defaultValue="popup_customer">
              <option value="popup_customer">Pop-up collector</option>
              <option value="wholesale_applicant">Wholesale applicant</option>
              <option value="wholesale_buyer">Wholesale buyer</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            Ontario region, required for a wholesale buyer
            <select name="regionId" defaultValue="">
              <option value="">None</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create invite</button>
        </form>
        <ul className="mt-6 space-y-2 text-sm">
          {invites.map(({ invitation, region }) => (
            <li key={invitation.id}>
              {invitation.email} · {invitation.role}
              {region ? ` · ${region.name}` : ""} · {invitation.acceptedAt ? "accepted" : "open"} ·{" "}
              {origin}/invite/{invitation.token}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
