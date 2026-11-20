"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/admin/shell";
import { saveDropWizard } from "@/server/desk-actions";

export type WizardStart = {
  id?: string;
  city: string;
  date: string;
  strains: string[];
  boxQuantity: string;
  boxPrice: string;
  jarQuantities: string[];
  jarPrice: string;
  earlyHours: string;
};

const strainLabels = ["First strain", "Second strain", "Third strain", "Fourth strain"];

function sundayLabel(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 17)));
}

export function DropWizard({
  cities,
  sundays,
  prices,
  initial,
  today,
}: {
  cities: { slug: string; name: string; place: string }[];
  sundays: string[];
  prices: Record<string, { box: string; jar: string }>;
  initial: WizardStart;
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [city, setCity] = useState(initial.city);
  const [date, setDate] = useState(initial.date);
  const [strains, setStrains] = useState(initial.strains);
  const [boxQuantity, setBoxQuantity] = useState(initial.boxQuantity);
  const [boxPrice, setBoxPrice] = useState(initial.boxPrice);
  const [jarQuantities, setJarQuantities] = useState(initial.jarQuantities);
  const [jarPrice, setJarPrice] = useState(initial.jarPrice);
  const [earlyHours, setEarlyHours] = useState(initial.earlyHours);
  const [error, setError] = useState("");
  const [field, setField] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  const selected = cities.find((item) => item.slug === city);

  function chooseCity(slug: string) {
    setCity(slug);
    setError("");
    const next = prices[slug];
    if (next) {
      setBoxPrice(next.box);
      setJarPrice(next.jar);
    }
    if (slug === "vancouver") setDate("");
  }

  function nextStep() {
    if (step === 0 && !city) return setError("Choose a city.");
    if (step === 0 && !date) return setError("Choose a date.");
    if (step === 1 && strains.some((name) => name.trim().length < 2)) return setError("Enter all four strain names.");
    if (step === 1 && (Number(boxQuantity) < 1 || Number(boxQuantity) > 16)) return setError("A drop has between 1 and 16 boxes.");
    if (step === 1 && !boxPrice.trim()) return setError("Enter the box price.");
    if (step === 2 && jarQuantities.some((qty) => qty.trim() === "" || Number(qty) < 0)) return setError("Enter a jar count for each strain.");
    if (step === 2 && !jarPrice.trim()) return setError("Enter the jar price.");
    setError("");
    setField("");
    setStep((current) => Math.min(current + 1, 3));
  }

  async function save(publish: boolean) {
    setSaving(publish ? "publish" : "draft");
    setError("");
    const result = await saveDropWizard({
      id: initial.id,
      city,
      date,
      strains,
      boxQuantity: Number(boxQuantity),
      boxPrice,
      jarQuantities: jarQuantities.map(Number),
      jarPrice,
      earlyHours: Number(earlyHours || 3),
      publish,
    });
    setSaving(null);
    if (!result.ok) {
      setError(result.error);
      setField(result.field ?? "");
      toast({ tone: "bad", text: result.error });
      return;
    }
    toast({ tone: "ok", text: publish ? "Drop is published." : "Draft saved." });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <ol className="grid grid-cols-4 gap-2">
        {["City", "Box", "Jars", "Review"].map((label, index) => (
          <li key={label}>
            <div className={`h-1 ${index <= step ? "bg-ink" : "bg-line"}`} />
            <p className={`mt-2 text-[10px] uppercase tracking-[0.16em] ${index === step ? "" : "text-mute"}`}>{label}</p>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="grid gap-3">
          {cities.map((item) => (
            <button
              key={item.slug}
              type="button"
              className={city === item.slug ? "" : "secondary"}
              onClick={() => chooseCity(item.slug)}
            >
              {item.name}
            </button>
          ))}
          {selected ? <p className="text-sm text-mute">{selected.place}</p> : null}
          {city === "toronto" ? (
            <div className="grid gap-2">
              {(date && !sundays.includes(date) ? [date, ...sundays] : sundays).map((sunday) => (
                <button key={sunday} type="button" className={date === sunday ? "" : "secondary"} onClick={() => setDate(sunday)}>
                  Sunday, {sundayLabel(sunday)}
                </button>
              ))}
            </div>
          ) : null}
          {city === "vancouver" ? (
            <label>
              Date
              <input type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-3">
          {strainLabels.map((label, index) => (
            <label key={label}>
              {label}
              <input
                value={strains[index] ?? ""}
                onChange={(event) => setStrains(strains.map((name, i) => (i === index ? event.target.value : name)))}
              />
            </label>
          ))}
          <label>
            How many 4-Strain Boxes
            <input inputMode="numeric" value={boxQuantity} onChange={(event) => setBoxQuantity(event.target.value)} />
          </label>
          <label>
            Price for a 4-Strain Box ({selected?.name})
            <input inputMode="decimal" value={boxPrice} onChange={(event) => setBoxPrice(event.target.value)} />
          </label>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-3">
          {strainLabels.map((label, index) => (
            <label key={label}>
              7 g jars of {strains[index] || label.toLowerCase()}
              <input
                inputMode="numeric"
                value={jarQuantities[index] ?? ""}
                onChange={(event) => setJarQuantities(jarQuantities.map((qty, i) => (i === index ? event.target.value : qty)))}
              />
            </label>
          ))}
          <label>
            Price for each 7 g jar ({selected?.name})
            <input inputMode="decimal" value={jarPrice} onChange={(event) => setJarPrice(event.target.value)} />
          </label>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="grid gap-4">
          <label>
            Early access, hours before everyone else
            <input inputMode="numeric" value={earlyHours} onChange={(event) => setEarlyHours(event.target.value)} />
          </label>
          <div className="border border-line p-4 text-sm leading-relaxed">
            <p>{selected?.name}</p>
            <p className="mt-1 text-mute">{selected?.place}</p>
            <p className="mt-3">{date}</p>
            <p className="mt-3">{strains.filter(Boolean).join(", ")}</p>
            <p className="mt-3">
              {boxQuantity || "0"} boxes at ${boxPrice || "0"}. Jars: {jarQuantities.join(", ")} at ${jarPrice || "0"} each.
            </p>
            <p className="mt-3 text-mute">Early access opens {earlyHours || "3"} hours before the public window. The drop runs 12:00 to 6:00 PM local time.</p>
          </div>
          <button type="button" disabled={saving !== null} onClick={() => void save(false)}>
            {saving === "draft" ? "Saving…" : "Save as draft"}
          </button>
          <button type="button" className="secondary" disabled={saving !== null} onClick={() => void save(true)}>
            {saving === "publish" ? "Publishing…" : "Publish"}
          </button>
        </section>
      ) : null}

      {error ? <p className={`text-sm ${field ? "" : ""}`}>{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <button type="button" className="secondary" onClick={() => setStep((current) => current - 1)}>
            Back
          </button>
        ) : null}
        {step < 3 ? (
          <button type="button" onClick={nextStep}>
            Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}
