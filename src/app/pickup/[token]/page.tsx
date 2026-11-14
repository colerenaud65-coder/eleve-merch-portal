import { notFound } from "next/navigation";

import { OrderTicket } from "@/components/order-ticket";
import { getOrderByPickupToken } from "@/server/queries";

export const metadata = { title: "Pickup", robots: { index: false } };

export default async function PickupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const detail = await getOrderByPickupToken(token);
  if (!detail) notFound();

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="mb-6 text-[11px] uppercase tracking-[0.2em] text-mute">Pickup</p>
      <OrderTicket detail={detail} showQr={false} />
    </main>
  );
}
