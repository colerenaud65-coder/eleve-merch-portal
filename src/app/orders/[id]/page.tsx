import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderTicket } from "@/components/order-ticket";
import { getCurrentAccount } from "@/server/auth";
import { getOrderDetail } from "@/server/queries";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const account = await getCurrentAccount();
  const allowed = account && (account.role === "admin" || account.id === detail.order.accountId);
  if (!allowed) notFound();

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <OrderTicket detail={detail} showQr />
      <Link href="/account" className="btn secondary mt-8">
        Account
      </Link>
    </main>
  );
}
