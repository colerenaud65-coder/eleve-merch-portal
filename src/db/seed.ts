import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import {
  EDITION_SIZE,
  RETAIL_BOX_CENTS,
  RETAIL_JAR_CENTS,
  RETAIL_JAR_ON_HAND,
  RETAIL_SELECTION_ON_HAND,
  WHOLESALE_JAR_CENTS,
  WHOLESALE_JAR_ON_HAND,
  WHOLESALE_SELECTION_ON_HAND,
  WHOLESALE_SET_CENTS,
  eventSeeds,
  productSeeds,
  regionSeeds,
} from "./catalog";
import { getDb } from "./index";
import {
  accessRequests,
  accounts,
  events,
  inventory,
  prices,
  products,
  regions,
  wholesaleApplications,
} from "./schema";

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

  for (const product of productSeeds) {
    if (product.kind === "selection_set") continue;
    for (const region of regionSeeds) {
      const retail = region.channel === "retail";
      const onHand =
        product.kind === "selection"
          ? retail
            ? RETAIL_SELECTION_ON_HAND
            : WHOLESALE_SELECTION_ON_HAND
          : retail
            ? RETAIL_JAR_ON_HAND
            : WHOLESALE_JAR_ON_HAND;
      await db
        .insert(inventory)
        .values({
          productId: productBySlug.get(product.slug)!.id,
          regionId: regionBySlug.get(region.slug)!,
          onHand,
          reserved: 0,
        })
        .onConflictDoNothing({
          target: [inventory.productId, inventory.regionId],
        });
    }
  }

  for (const event of eventSeeds) {
    const values = {
      slug: event.slug,
      name: event.name,
      regionId: regionBySlug.get(event.regionSlug)!,
      venue: event.venue,
      city: event.city,
      summary: event.summary,
      timeZone: event.timeZone,
      startsAt: new Date(event.startsAt),
      endsAt: new Date(event.endsAt),
      preorderOpensAt: new Date(event.preorderOpensAt),
      preorderClosesAt: new Date(event.preorderClosesAt),
      complianceConfirmed: event.complianceConfirmed,
      complianceConfirmedAt: event.complianceConfirmed ? new Date(event.preorderOpensAt) : null,
      complianceNote: event.complianceNote,
    };
    await db.insert(events).values(values).onConflictDoNothing({ target: events.slug });
  }

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

  const selectionCount = productSeeds.filter((product) => product.kind === "selection").length;
  if (selectionCount !== EDITION_SIZE) {
    throw new Error(`Expected ${EDITION_SIZE} selections, found ${selectionCount}.`);
  }

  console.log("Seeded Élevé Select.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
