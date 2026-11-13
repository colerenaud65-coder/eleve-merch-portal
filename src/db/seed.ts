import { config } from "dotenv";

config({ path: ".env.local" });

import { eq, inArray, notInArray } from "drizzle-orm";

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
  deposits,
  events,
  inventory,
  orderLines,
  orders,
  prices,
  products,
  regions,
  selectionLineups,
  wholesaleApplications,
} from "./schema";

function resetAllowed() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.VERCEL_ENV !== "preview"
  );
}

async function main() {
  const db = getDb();
  const regionBySlug = new Map<string, string>();

  for (const region of regionSeeds) {
    const [row] = await db
      .insert(regions)
      .values(region)
      .onConflictDoUpdate({
        target: regions.slug,
        set: {
          name: region.name,
          country: region.country,
          currency: region.currency,
          channel: region.channel,
          minimumAge: region.minimumAge,
          timeZone: region.timeZone,
          sortOrder: region.sortOrder,
        },
      })
      .returning();
    regionBySlug.set(region.slug, row.id);
  }

  const productBySlug = new Map<string, { id: string; kind: string }>();
  for (const product of productSeeds) {
    const [row] = await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: product.name,
          kind: product.kind,
          editionNumber: product.editionNumber,
          editionSize: product.editionSize,
          subtitle: product.subtitle,
          description: product.description,
          imagePath: product.imagePath,
          sortOrder: product.sortOrder,
          active: true,
        },
      })
      .returning();
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
          .onConflictDoUpdate({
            target: [prices.productId, prices.regionId, prices.channel],
            set: { amountCents },
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
          .onConflictDoUpdate({
            target: [prices.productId, prices.regionId, prices.channel],
            set: { amountCents },
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
          .onConflictDoUpdate({
            target: [prices.productId, prices.regionId, prices.channel],
            set: { amountCents: WHOLESALE_JAR_CENTS },
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
          .onConflictDoUpdate({
            target: [prices.productId, prices.regionId, prices.channel],
            set: { amountCents: WHOLESALE_SET_CENTS },
          });
      }
    }
  }

  const allowReset = resetAllowed();
  if (allowReset) {
    await db.delete(deposits);
    await db.delete(orderLines);
    await db.delete(orders);
  }

  const keep = productSeeds.map((product) => product.slug);
  const stale = await db.select({ id: products.id }).from(products).where(notInArray(products.slug, keep));
  if (stale.length > 0) {
    const ids = stale.map((row) => row.id);
    if (allowReset) {
      await db.delete(selectionLineups).where(inArray(selectionLineups.productId, ids));
      await db.delete(inventory).where(inArray(inventory.productId, ids));
      await db.delete(prices).where(inArray(prices.productId, ids));
      await db.delete(products).where(inArray(products.id, ids));
    } else {
      await db.update(products).set({ active: false, imagePath: null }).where(inArray(products.id, ids));
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
      if (allowReset) {
        await db
          .insert(inventory)
          .values({
            productId: productBySlug.get(product.slug)!.id,
            regionId: regionBySlug.get(region.slug)!,
            onHand,
            reserved: 0,
          })
          .onConflictDoUpdate({
            target: [inventory.productId, inventory.regionId],
            set: { onHand, reserved: 0 },
          });
      } else {
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
    if (allowReset) {
      await db.insert(events).values(values).onConflictDoUpdate({
        target: events.slug,
        set: values,
      });
    } else {
      await db.insert(events).values(values).onConflictDoNothing({ target: events.slug });
    }
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "cole@eleve.select").toLowerCase();
  await db
    .insert(accounts)
    .values({
      email: adminEmail,
      name: "Cole",
      role: "admin",
      status: "approved",
      approvedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: accounts.email,
      set: {
        role: "admin",
        status: "approved",
        approvedAt: new Date(),
      },
    });

  if (allowReset) {
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
      await db
        .insert(accounts)
        .values(demo)
        .onConflictDoUpdate({
          target: accounts.email,
          set: {
            name: demo.name,
            role: demo.role,
            status: demo.status,
            regionId: demo.regionId,
            approvedAt: demo.approvedAt,
          },
        });
    }

    const [applicant] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, "applicant@eleve.select"))
      .limit(1);
    if (applicant) {
      await db.delete(wholesaleApplications).where(eq(wholesaleApplications.accountId, applicant.id));
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
