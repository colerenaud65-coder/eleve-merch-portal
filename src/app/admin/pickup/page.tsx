import { checkInPickup } from "@/server/actions";
import { PickupScanner } from "@/components/pickup-scanner";
import { OrderTicket } from "@/components/order-ticket";
import { getOrderByPickupToken } from "@/server/queries";

export const metadata = { title: "Pickup" };

export default async function PickupAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; missing?: string }>;
}) {
  const { token, missing } = await searchParams;
  const detail = token ? await getOrderByPickupToken(token) : null;

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-serif text-5xl">Pickup</h1>
        <p className="mt-3 max-w-lg text-sm text-mute">
          Scan the order QR code, or paste the pickup link. A handheld scanner can type into the field and press enter.
          Checking in records any balance still due and closes the order.
        </p>
      </div>
      <PickupScanner />
      {missing ? <p className="text-sm">No open order matched that code.</p> : null}
      {token && !detail ? <p className="text-sm">No order matched that code.</p> : null}
      {detail ? (
        <div className="space-y-4">
          <OrderTicket detail={detail} showQr={false} />
          {detail.order.status === "completed" ? (
            <p className="text-sm">Already checked in.</p>
          ) : detail.order.status === "cancelled" ? (
            <p className="text-sm">This order was cancelled. The numbered boxes are back in stock.</p>
          ) : (
            <form action={checkInPickup}>
              <input type="hidden" name="token" value={detail.order.pickupToken} />
              <button type="submit">
                {detail.order.balanceCents > 0 ? "Take the balance and check in" : "Check in"}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </main>
  );
}
