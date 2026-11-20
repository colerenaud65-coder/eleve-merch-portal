import { SubmitButton } from "@/components/admin/confirm-submit";
import { DeskHeader } from "@/components/admin/desk-header";
import { saveInventory } from "@/server/actions";
import { listInventory } from "@/server/queries";

export default async function WholesalePage() {
  const stock = (await listInventory()).filter((row) => row.region.channel === "wholesale");
  return (
    <>
      <DeskHeader title="Wholesale" back="/admin/more" detail="These counts are for wholesale, separate from a pop-up drop." />
      {stock.length === 0 ? <p className="text-sm text-mute">No wholesale stock is set up.</p> : null}
      {stock.length > 0 ? (
        <form action={saveInventory} className="grid gap-3">
          {stock.map((row) => (
            <label key={row.inventory.id}>
              {row.region.name} · {row.product.name}
              <span className="normal-case tracking-normal text-mute">{row.inventory.reserved} already held</span>
              <input name={`onHand:${row.inventory.id}`} type="number" min={row.inventory.reserved} defaultValue={row.inventory.onHand} />
            </label>
          ))}
          <SubmitButton>Save counts</SubmitButton>
        </form>
      ) : null}
    </>
  );
}
