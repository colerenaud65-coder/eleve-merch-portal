import { DeskHeader } from "@/components/admin/desk-header";
import { DropWizard } from "@/components/admin/drop-wizard";
import { localDate, wizardSeed } from "@/server/desk";

export default async function NewDropPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const seed = await wizardSeed(from, false);
  return (
    <>
      <DeskHeader title={from ? "Copy a drop" : "Create drop"} back="/admin/drops" detail="Four short steps. You can save a draft and come back." />
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
