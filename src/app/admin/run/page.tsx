import { DeskHeader } from "@/components/admin/desk-header";
import { RunDesk } from "@/components/admin/run-desk";
import { deskStatus, deskStatusLabel, orderChip } from "@/server/desk";
import { formatMoney } from "@/server/money";
import { getDropOffer, getOrderByPickupToken, listAllEvents, listAllOrders } from "@/server/queries";

export default async function RunPage({
  searchParams,
}: {
  searchParams: Promise<{ drop?: string; token?: string; missing?: string }>;
}) {
  const { drop, token, missing } = await searchParams;
  const events = await listAllEvents();
  const scanned = token ? await getOrderByPickupToken(token) : null;
  const chosen =
    events.find((row) => row.event.id === (scanned?.order.eventId ?? drop)) ??
    events.find((row) => !row.event.archived && !row.event.cancelled) ??
    events[0];

  if (!chosen) {
    return <DeskHeader title="Run drop" back="/admin" detail="Create a drop before the door opens." />;
  }

  const { event } = chosen;
  const offer = await getDropOffer(event.id, event.regionId);
  const jarsLeft = offer.strains.reduce((sum, strain) => sum + Math.max(strain.jarOnHand - strain.jarReserved, 0), 0);
  const status = deskStatus(event, jarsLeft);
  const orders = await listAllOrders(event.id);
  const stock = [
    {
      label: "4-Strain Box",
      left: `${Math.max(event.boxOnHand - event.boxReserved, 0)} left${event.boxReserved ? `, ${event.boxReserved} held` : ""}`,
    },
    ...offer.strains.map((strain) => ({
      label: strain.name || `Strain ${strain.position}`,
      left: `${Math.max(strain.jarOnHand - strain.jarReserved, 0)} jars left${strain.jarReserved ? `, ${strain.jarReserved} held` : ""}`,
    })),
  ];

  return (
    <>
      <DeskHeader
        title="Run drop"
        back="/admin"
        detail={`${event.name} · ${event.city} · ${deskStatusLabel[status]}`}
      />
      {token && !scanned ? <p className="mb-4 text-sm">No order matched that code.</p> : null}
      {missing ? <p className="mb-4 text-sm">No order matched that code.</p> : null}
      <RunDesk
        dropId={event.id}
        closed={event.cancelled}
        initialQuery={scanned?.order.eventId === event.id ? scanned.order.number : ""}
        stock={stock}
        orders={orders.map(({ order, account }) => ({
          id: order.id,
          number: order.number,
          name: account.name,
          chip: orderChip(order.status),
          money: `${formatMoney(order.depositReceivedCents, order.currency)} in · ${formatMoney(order.balanceCents, order.currency)} still due`,
          deposit: order.status !== "cancelled" && order.status !== "completed" && order.depositReceivedCents < order.depositRequiredCents,
          pickup: order.status !== "cancelled" && order.status !== "completed",
        }))}
      />
    </>
  );
}
