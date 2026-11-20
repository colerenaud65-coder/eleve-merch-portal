import { notFound } from "next/navigation";

import { DeskHeader } from "@/components/admin/desk-header";
import { DropAlerts } from "@/components/admin/drop-alerts";
import { DropWizard } from "@/components/admin/drop-wizard";
import { alertPreview } from "@/server/alerts";
import { localDate, wizardSeed } from "@/server/desk";

export default async function EditDropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seed = await wizardSeed(id, true);
  if (!seed.initial.id) notFound();
  const alerts = await alertPreview(id);
  return (
    <>
      <DeskHeader title="Edit drop" back="/admin/drops" />
      {alerts ? (
        <div className="mb-8">
          <DropAlerts eventId={id} preview={alerts} />
        </div>
      ) : null}
      <DropWizard
        cities={seed.cities}
        sundays={seed.sundays}
        prices={seed.prices}
        initial={seed.initial}
        today={localDate(new Date(), "America/Vancouver")}
      />
    </>
  );
}
