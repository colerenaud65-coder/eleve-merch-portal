import { and, eq } from "drizzle-orm";

import { TORONTO_DROP, VANCOUVER_DROP } from "@/db/catalog";
import { getDb } from "@/db/index";
import { dropStrains, events, prices, products, regions } from "@/db/schema";
import { dollarsToCents } from "@/server/money";
import type { AlertPreview } from "@/server/alerts";
import { earlyAccessAt, zonedLocalToUtc } from "@/server/time";

export type DeskStatus = "draft" | "scheduled" | "early" | "live" | "soldout" | "ended";

export const deskStatusLabel: Record<DeskStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  early: "Early access",
  live: "Live",
  soldout: "Sold out",
  ended: "Ended",
};

export function deskStatus(
  event: {
    cancelled: boolean;
    complianceConfirmed: boolean;
    endsAt: Date;
    preorderOpensAt: Date;
    preorderClosesAt: Date;
    earlyAccessOpensAt?: Date | null;
    boxOnHand: number;
    boxReserved: number;
  },
  jarsLeft: number,
  now = new Date(),
): DeskStatus {
  if (event.cancelled || now >= event.endsAt) return "ended";
  if (!event.complianceConfirmed) return "draft";
  if (event.boxOnHand - event.boxReserved <= 0 && jarsLeft <= 0) return "soldout";
  const early = earlyAccessAt(event);
  if (now < early) return "scheduled";
  if (now < event.preorderOpensAt) return "early";
  return "live";
}

export function upcomingSundays(timeZone: string, count = 8, now = new Date()) {
  const dates: string[] = [];
  for (let offset = 0; offset < 70 && dates.length < count; offset += 1) {
    const probe = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(probe);
    if (weekday !== "Sun") continue;
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(probe);
    if (!dates.includes(ymd)) dates.push(ymd);
  }
  return dates;
}

export function localDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type WizardInput = {
  id?: string;
  city: string;
  date: string;
  strains: string[];
  boxQuantity: number;
  boxPrice: string;
  jarQuantities: number[];
  jarPrice: string;
  earlyHours: number;
  publish: boolean;
};

export type WizardResult = { ok: true; id: string; alerts?: AlertPreview } | { ok: false; error: string; field?: string };

function hoursBetween(later: Date, earlier: Date) {
  return Math.round((later.getTime() - earlier.getTime()) / (60 * 60 * 1000));
}

export function earlyHoursOf(event: { preorderOpensAt: Date; earlyAccessOpensAt: Date | null }) {
  if (!event.earlyAccessOpensAt) return 3;
  return Math.max(0, hoursBetween(event.preorderOpensAt, event.earlyAccessOpensAt));
}

export async function saveWizard(input: WizardInput): Promise<WizardResult> {
  const city = input.city === "toronto" || input.city === "vancouver" ? input.city : "";
  if (!city) return { ok: false, error: "Choose Toronto or Vancouver.", field: "city" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Choose a date.", field: "date" };
  const place = city === "toronto" ? TORONTO_DROP : VANCOUVER_DROP;
  const timeZone = city === "toronto" ? "America/Toronto" : "America/Vancouver";
  if (city === "toronto") {
    const noon = zonedLocalToUtc(`${input.date}T12:00`, timeZone);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noon);
    if (weekday !== "Sun") return { ok: false, error: "Toronto drops are on Sunday.", field: "date" };
  }
  const strains = input.strains.map((name) => name.trim());
  if (strains.length !== 4 || strains.some((name) => name.length < 2)) {
    return { ok: false, error: "Enter all four strain names.", field: "strains" };
  }
  if (!Number.isInteger(input.boxQuantity) || input.boxQuantity < 1 || input.boxQuantity > 16) {
    return { ok: false, error: "A drop has between 1 and 16 boxes.", field: "boxQuantity" };
  }
  const boxCents = dollarsToCents(input.boxPrice);
  if (!boxCents) return { ok: false, error: "Enter the box price.", field: "boxPrice" };
  if (input.jarQuantities.length !== 4 || input.jarQuantities.some((qty) => !Number.isInteger(qty) || qty < 0 || qty > 500)) {
    return { ok: false, error: "Enter a jar count for each strain.", field: "jars" };
  }
  const jarCents = dollarsToCents(input.jarPrice);
  if (!jarCents) return { ok: false, error: "Enter the jar price.", field: "jarPrice" };
  if (!Number.isInteger(input.earlyHours) || input.earlyHours < 0 || input.earlyHours > 72) {
    return { ok: false, error: "Early access is between 0 and 72 hours.", field: "earlyHours" };
  }

  const db = getDb();
  const [region] = await db.select().from(regions).where(eq(regions.slug, city)).limit(1);
  if (!region) return { ok: false, error: "That city is not set up yet." };

  const startsAt = zonedLocalToUtc(`${input.date}T12:00`, timeZone);
  const endsAt = zonedLocalToUtc(`${input.date}T18:00`, timeZone);
  const preorderOpensAt = new Date(startsAt.getTime() - 6 * 24 * 60 * 60 * 1000);
  const earlyAccessOpensAt = new Date(preorderOpensAt.getTime() - input.earlyHours * 60 * 60 * 1000);

  const [box] = await db.select().from(products).where(eq(products.slug, "selection-box")).limit(1);
  const [jar] = await db.select().from(products).where(eq(products.slug, "jar-7g")).limit(1);
  if (!box || !jar) return { ok: false, error: "The box and jar are missing from the catalog." };

  const existing = input.id
    ? (await db.select().from(events).where(eq(events.id, input.id)).limit(1))[0]
    : undefined;
  if (input.id && !existing) return { ok: false, error: "That drop is gone." };
  if (existing && input.boxQuantity < existing.boxReserved) {
    return {
      ok: false,
      error: `${existing.boxReserved} boxes are already held. The total has to be at least that.`,
      field: "boxQuantity",
    };
  }
  if (existing) {
    const held = await db.select().from(dropStrains).where(eq(dropStrains.eventId, existing.id));
    for (const row of held) {
      const requested = input.jarQuantities[row.position - 1] ?? 0;
      if (requested < row.jarReserved) {
        return {
          ok: false,
          error: `${row.jarReserved} jars of ${row.name || "that strain"} are already held. The count has to be at least that.`,
          field: "jars",
        };
      }
    }
  }

  const slugBase = `${city === "toronto" ? "sunday-service" : "dank-club"}-${input.date}`;
  let slug = existing?.slug ?? slugBase;
  if (!existing) {
    const taken = await db.select({ id: events.id }).from(events).where(eq(events.slug, slugBase)).limit(1);
    slug = taken[0] ? `${slugBase}-${Math.random().toString(36).slice(2, 6)}` : slugBase;
  }

  const saved = await db.transaction(async (tx) => {
    const values = {
      name: place.name,
      venue: place.venue,
      city: place.city,
      summary: place.summary || "Pop-up.",
      timeZone,
      regionId: region.id,
      boxOnHand: input.boxQuantity,
      complianceConfirmed: input.publish,
      complianceConfirmedAt: input.publish ? existing?.complianceConfirmedAt ?? new Date() : null,
    };
    let eventId = existing?.id;
    if (!existing) {
      const [created] = await tx
        .insert(events)
        .values({
          ...values,
          slug,
          startsAt,
          endsAt,
          preorderOpensAt,
          preorderClosesAt: startsAt,
          earlyAccessOpensAt,
          cancelled: false,
        })
        .returning({ id: events.id });
      eventId = created?.id;
    } else {
      const dateChanged = localDate(existing.startsAt, existing.timeZone) !== input.date;
      await tx
        .update(events)
        .set({
          ...values,
          ...(dateChanged
            ? { startsAt, endsAt, preorderOpensAt, preorderClosesAt: startsAt, earlyAccessOpensAt }
            : { earlyAccessOpensAt: new Date(existing.preorderOpensAt.getTime() - input.earlyHours * 60 * 60 * 1000) }),
        })
        .where(eq(events.id, existing.id));
    }
    if (!eventId) return null;
    for (let position = 1; position <= 4; position += 1) {
      const [current] = await tx
        .select()
        .from(dropStrains)
        .where(and(eq(dropStrains.eventId, eventId), eq(dropStrains.position, position)))
        .limit(1);
      const requested = input.jarQuantities[position - 1] ?? 0;
      const jarOnHand = Math.max(requested, current?.jarReserved ?? 0);
      await tx
        .insert(dropStrains)
        .values({ eventId, position, name: strains[position - 1] ?? "", jarOnHand, jarReserved: 0 })
        .onConflictDoUpdate({
          target: [dropStrains.eventId, dropStrains.position],
          set: { name: strains[position - 1] ?? "", jarOnHand },
        });
    }
    for (const [productId, amountCents] of [
      [box.id, boxCents],
      [jar.id, jarCents],
    ] as const) {
      await tx
        .insert(prices)
        .values({ productId, regionId: region.id, channel: "retail", amountCents })
        .onConflictDoUpdate({
          target: [prices.productId, prices.regionId, prices.channel],
          set: { amountCents },
        });
    }
    return eventId;
  });

  if (!saved) return { ok: false, error: "The drop did not save." };
  return { ok: true, id: saved };
}

function dollars(cents: number | undefined) {
  if (!cents) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export async function wizardSeed(sourceId?: string, editing = false) {
  const { listRetailRegions } = await import("@/server/queries");
  const retail = await listRetailRegions();
  const db = getDb();
  const priceRows = await db
    .select({ amountCents: prices.amountCents, productSlug: products.slug, regionSlug: regions.slug })
    .from(prices)
    .innerJoin(products, eq(products.id, prices.productId))
    .innerJoin(regions, eq(regions.id, prices.regionId))
    .where(eq(prices.channel, "retail"));
  const priceMap: Record<string, { box: string; jar: string }> = {};
  for (const region of retail) {
    const box = priceRows.find((row) => row.regionSlug === region.slug && row.productSlug === "selection-box");
    const jar = priceRows.find((row) => row.regionSlug === region.slug && row.productSlug === "jar-7g");
    priceMap[region.slug] = { box: dollars(box?.amountCents), jar: dollars(jar?.amountCents) };
  }
  const cities = retail
    .filter((region) => region.slug === "toronto" || region.slug === "vancouver")
    .map((region) => ({
      slug: region.slug,
      name: region.name,
      place:
        region.slug === "toronto"
          ? "Sunday Service by Caked, 1196 Queen St W. Sundays, 12:00 to 6:00 PM ET."
          : "Dank Club, 6416 Main St. 12:00 to 6:00 PM local time.",
    }));
  const blank: {
    id?: string;
    city: string;
    date: string;
    strains: string[];
    boxQuantity: string;
    boxPrice: string;
    jarQuantities: string[];
    jarPrice: string;
    earlyHours: string;
  } = {
    city: cities[0]?.slug ?? "",
    date: "",
    strains: ["", "", "", ""],
    boxQuantity: "16",
    boxPrice: priceMap[cities[0]?.slug ?? ""]?.box ?? "",
    jarQuantities: ["0", "0", "0", "0"],
    jarPrice: priceMap[cities[0]?.slug ?? ""]?.jar ?? "",
    earlyHours: "3",
  };
  if (!sourceId) return { cities, sundays: upcomingSundays("America/Toronto"), prices: priceMap, initial: blank };
  const [row] = await db
    .select({ event: events, region: regions })
    .from(events)
    .innerJoin(regions, eq(regions.id, events.regionId))
    .where(eq(events.id, sourceId))
    .limit(1);
  if (!row) return { cities, sundays: upcomingSundays("America/Toronto"), prices: priceMap, initial: blank };
  const strainRows = await db.select().from(dropStrains).where(eq(dropStrains.eventId, row.event.id));
  const names = [1, 2, 3, 4].map((position) => strainRows.find((strain) => strain.position === position)?.name ?? "");
  const jars = [1, 2, 3, 4].map((position) => String(strainRows.find((strain) => strain.position === position)?.jarOnHand ?? 0));
  return {
    cities,
    sundays: upcomingSundays("America/Toronto"),
    prices: priceMap,
    initial: {
      ...(editing ? { id: row.event.id } : {}),
      city: row.region.slug,
      date: editing ? localDate(row.event.startsAt, row.event.timeZone) : "",
      strains: names,
      boxQuantity: String(row.event.boxOnHand),
      boxPrice: priceMap[row.region.slug]?.box ?? "",
      jarQuantities: jars,
      jarPrice: priceMap[row.region.slug]?.jar ?? "",
      earlyHours: String(earlyHoursOf(row.event)),
    },
  };
}

export function orderChip(status: string) {
  if (status === "awaiting_deposit" || status === "deposit_partial") return "Deposit pending";
  if (status === "deposit_received" || status === "on_terms") return "Deposit received";
  if (status === "ready_for_pickup") return "Ready";
  if (status === "completed") return "Picked up";
  return "Cancelled";
}
