import { notFound } from "next/navigation";

import { DeskHeader } from "@/components/admin/desk-header";
import { DropWizard } from "@/components/admin/drop-wizard";
import { localDate, wizardSeed } from "@/server/desk";

export default async function EditDropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seed = await wizardSeed(id, true);
  if (!seed.initial.id) notFound();
  return (
    <>
      <DeskHeader title="Edit drop" back="/admin/drops" />
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
