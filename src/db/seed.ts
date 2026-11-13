import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import {
  RETAIL_BOX_CENTS,
  RETAIL_JAR_CENTS,
  TORONTO_DROP,
  VANCOUVER_DROP,
  WHOLESALE_JAR_CENTS,
  WHOLESALE_JAR_ON_HAND,
  WHOLESALE_SET_CENTS,
  productSeeds,
  regionSeeds,
} from "./catalog";
import { getDb } from "./index";
import {
  accessRequests,
  accounts,
  dropStrains,
  events,
  inventory,
  orders,
  prices,
  products,
  regions,
  selectionLineups,
  waitlistEntries,
  wholesaleApplications,
} from "./schema";
import { zonedLocalToUtc } from "../server/time";

function localPersonas() {
  return !process.env.VERCEL_ENV;
}

async function main() {
  const db = getDb();
  const regionBySlug = new Map<string, string>();

  for (const region of regionSeeds) {
    await db.insert(regions).values(region).onConflictDoNothing({ target: regions.slug });
    const [row] = await db.select().from(regions).where(eq(regions.slug, region.slug)).limit(1);
    if (!row) throw new Error(`Region ${region.slug} was not seeded.`);
    regionBySlug.set(region.slug, row.id);
  }

  const productBySlug = new Map<string, { id: string; kind: string }>();
  for (const product of productSeeds) {
    await db.insert(products).values(product).onConflictDoNothing({ target: products.slug });
    const [row] = await db.select().from(products).where(eq(products.slug, product.slug)).limit(1);
    if (!row) throw new Error(`Product ${product.slug} was not seeded.`);
    productBySlug.set(product.slug, { id: row.id, kind: row.kind });
  }

  for (const product of productSeeds) {
    const productId = productBySlug.get(product.slug)!.id;
    if (product.kind === "selection") {
      for (const [slug, amountCents] of Object.entries(RETAIL_BOX_CENTS)) {
        await db
          .insert(prices)
          .values({
            productId,
            regionId: regionBySlug.get(slug)!,
            channel: "retail",
            amountCents,
          })
          .onConflictDoNothing({
            target: [prices.productId, prices.regionId, prices.channel],
          });
      }
    }
    if (product.kind === "jar") {
      for (const [slug, amountCents] of Object.entries(RETAIL_JAR_CENTS)) {
        await db
          .insert(prices)
          .values({
            productId,
            regionId: regionBySlug.get(slug)!,
            channel: "retail",
            amountCents,
          })
          .onConflictDoNothing({
            target: [prices.productId, prices.regionId, prices.channel],
          });
      }
      for (const region of regionSeeds.filter((item) => item.channel === "wholesale")) {
        await db
          .insert(prices)
          .values({
            productId,
            regionId: regionBySlug.get(region.slug)!,
            channel: "wholesale",
            amountCents: WHOLESALE_JAR_CENTS,
          })
          .onConflictDoNothing({
            target: [prices.productId, prices.regionId, prices.channel],
          });
      }
    }
    if (product.kind === "selection_set") {
      for (const region of regionSeeds.filter((item) => item.channel === "wholesale")) {
        await db
          .insert(prices)
          .values({
            productId,
            regionId: regionBySlug.get(region.slug)!,
            channel: "wholesale",
            amountCents: WHOLESALE_SET_CENTS,
          })
          .onConflictDoNothing({
            target: [prices.productId, prices.regionId, prices.channel],
          });
      }
    }
  }

  for (let number = 1; number <= 16; number += 1) {
    await db
      .update(products)
      .set({ active: false })
      .where(eq(products.slug, `selection-${String(number).padStart(2, "0")}`));
  }
  for (const product of productSeeds) {
    const wholesaleOnly = product.kind === "selection_set" || product.kind === "jar";
    if (!wholesaleOnly) continue;
    for (const region of regionSeeds.filter((item) => item.channel === "wholesale")) {
      await db
        .insert(inventory)
        .values({
          productId: productBySlug.get(product.slug)!.id,
          regionId: regionBySlug.get(region.slug)!,
          onHand: product.kind === "selection_set" ? 4 : WHOLESALE_JAR_ON_HAND,
          reserved: 0,
        })
        .onConflictDoNothing({
          target: [inventory.productId, inventory.regionId],
        });
    }
  }

  await db.update(regions).set({ enabled: false }).where(eq(regions.slug, "united-states"));
  await db.update(regions).set({ enabled: true }).where(eq(regions.slug, "toronto"));
  await db.update(regions).set({ enabled: true }).where(eq(regions.slug, "vancouver"));

  async function retireEvent(slug: string) {
    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) return;
    const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.eventId, event.id)).limit(1);
    if (order) {
      await db.update(events).set({ cancelled: true }).where(eq(events.id, event.id));
      return;
    }
    await db.delete(waitlistEntries).where(eq(waitlistEntries.eventId, event.id));
    await db.delete(selectionLineups).where(eq(selectionLineups.eventId, event.id));
    await db.delete(dropStrains).where(eq(dropStrains.eventId, event.id));
    await db.delete(events).where(eq(events.id, event.id));
  }

  await retireEvent("toronto-king-west");
  await retireEvent("vancouver-railtown");
  await retireEvent("los-angeles-arts-district");

  const sundays: string[] = [];
  const cursor = new Date();
  for (let day = 0; day < 70 && sundays.length < 8; day += 1) {
    const date = new Date(cursor.getTime() + day * 24 * 60 * 60 * 1000);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Toronto",
      weekday: "short",
    }).format(date);
    if (weekday !== "Sun") continue;
    sundays.push(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date),
    );
  }

  const torontoId = regionBySlug.get("toronto")!;
  for (const [index, date] of sundays.entries()) {
    const slug = `sunday-service-${date}`;
    const startsAt = zonedLocalToUtc(`${date}T12:00`, "America/Toronto");
    const endsAt = zonedLocalToUtc(`${date}T18:00`, "America/Toronto");
    const preorderOpensAt = new Date(startsAt.getTime() - 6 * 24 * 60 * 60 * 1000);
    const inserted = await db
      .insert(events)
      .values({
        slug,
        name: TORONTO_DROP.name,
        regionId: torontoId,
        venue: TORONTO_DROP.venue,
        city: TORONTO_DROP.city,
        summary: TORONTO_DROP.summary,
        timeZone: "America/Toronto",
        startsAt,
        endsAt,
        preorderOpensAt,
        preorderClosesAt: startsAt,
        complianceConfirmed: index === 0,
        complianceConfirmedAt: index === 0 ? new Date() : null,
        complianceNote: index === 0 ? "Sunday Service is confirmed." : null,
        boxOnHand: 16,
        boxReserved: 0,
      })
      .onConflictDoNothing({ target: events.slug })
      .returning();
    await db
      .update(events)
      .set({
        name: TORONTO_DROP.name,
        venue: TORONTO_DROP.venue,
        city: TORONTO_DROP.city,
        summary: TORONTO_DROP.summary,
        timeZone: "America/Toronto",
      })
      .where(eq(events.slug, slug));
    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) continue;
    for (let position = 1; position <= 4; position += 1) {
      await db
        .insert(dropStrains)
        .values({
          eventId: event.id,
          position,
          name: "",
          jarOnHand: 12,
          jarReserved: 0,
        })
        .onConflictDoNothing({ target: [dropStrains.eventId, dropStrains.position] });
    }
    void inserted;
  }

  const vancouverId = regionBySlug.get("vancouver")!;
  const dankDate = sundays[2] ?? sundays[0];
  const dankStart = zonedLocalToUtc(`${dankDate}T14:00`, "America/Vancouver");
  const dankEnd = zonedLocalToUtc(`${dankDate}T20:00`, "America/Vancouver");
  const dankInserted = await db
    .insert(events)
    .values({
      slug: "dank-club",
      name: VANCOUVER_DROP.name,
      regionId: vancouverId,
      venue: VANCOUVER_DROP.venue,
      city: VANCOUVER_DROP.city,
      summary: VANCOUVER_DROP.summary,
      timeZone: "America/Vancouver",
      startsAt: dankStart,
      endsAt: dankEnd,
      preorderOpensAt: new Date(dankStart.getTime() - 7 * 24 * 60 * 60 * 1000),
      preorderClosesAt: dankStart,
      complianceConfirmed: false,
      boxOnHand: 16,
    })
    .onConflictDoNothing({ target: events.slug })
    .returning();
  await db
    .update(events)
    .set({
      name: VANCOUVER_DROP.name,
      venue: VANCOUVER_DROP.venue,
      city: VANCOUVER_DROP.city,
      summary: VANCOUVER_DROP.summary,
      timeZone: "America/Vancouver",
    })
    .where(eq(events.slug, "dank-club"));
  const [dank] = await db.select().from(events).where(eq(events.slug, "dank-club")).limit(1);
  if (dank) {
    for (let position = 1; position <= 4; position += 1) {
      await db
        .insert(dropStrains)
        .values({
          eventId: dank.id,
          position,
          name: "",
          jarOnHand: 12,
          jarReserved: 0,
        })
        .onConflictDoNothing({ target: [dropStrains.eventId, dropStrains.position] });
    }
  }
  void dankInserted;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    const [existingAdmin] = await db.select().from(accounts).where(eq(accounts.email, adminEmail)).limit(1);
    if (!existingAdmin) {
      await db.insert(accounts).values({
        email: adminEmail,
        name: "Cole",
        role: "admin",
        status: "approved",
        approvedAt: new Date(),
      });
    } else if (existingAdmin.role !== "admin" || existingAdmin.status !== "approved") {
      await db
        .update(accounts)
        .set({
          role: "admin",
          status: "approved",
          approvedAt: existingAdmin.approvedAt ?? new Date(),
        })
        .where(eq(accounts.id, existingAdmin.id));
    }
  }

  if (localPersonas()) {
    const horseshoe = regionBySlug.get("on-golden-horseshoe")!;
    const demos = [
      {
        email: "pending@eleve.select",
        name: "Pending collector",
        role: "popup_customer" as const,
        status: "pending" as const,
        regionId: null,
        approvedAt: null,
      },
      {
        email: "toronto@eleve.select",
        name: "Toronto collector",
        role: "popup_customer" as const,
        status: "approved" as const,
        regionId: null,
        approvedAt: new Date(),
      },
      {
        email: "applicant@eleve.select",
        name: "Wholesale applicant",
        role: "wholesale_applicant" as const,
        status: "approved" as const,
        regionId: null,
        approvedAt: new Date(),
      },
      {
        email: "buyer@eleve.select",
        name: "Horseshoe buyer",
        role: "wholesale_buyer" as const,
        status: "approved" as const,
        regionId: horseshoe,
        approvedAt: new Date(),
      },
    ];

    for (const demo of demos) {
      if (demo.email === adminEmail) continue;
      await db.insert(accounts).values(demo).onConflictDoNothing({ target: accounts.email });
    }

    const [applicant] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, "applicant@eleve.select"))
      .limit(1);
    if (applicant) {
      const [existingApplication] = await db
        .select({ id: wholesaleApplications.id })
        .from(wholesaleApplications)
        .where(eq(wholesaleApplications.accountId, applicant.id))
        .limit(1);
      if (!existingApplication) {
        await db.insert(wholesaleApplications).values({
        accountId: applicant.id,
        businessName: "Harbour Leaf",
        contactName: applicant.name,
        phone: "+1 416 555 0148",
        requestedRegionId: horseshoe,
        licenseNumber: "ON-RETAIL-DEMO",
        note: "Requesting the Golden Horseshoe desk.",
        status: "pending",
        });
      }
    }

    const [existingRequest] = await db.select({ id: accessRequests.id }).from(accessRequests).limit(1);
    if (!existingRequest) {
      await db.insert(accessRequests).values({
        name: "Sample collector",
        email: "sample.collector@example.com",
        city: "Toronto",
        channel: "Signal",
        phone: "",
        note: "Asked to be added for the King West drop.",
      });
    }
  }

  console.log("Seeded Élevé Select.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
