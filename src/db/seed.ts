import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";

import {
  RETAIL_BOX_CENTS,
  RETAIL_JAR_CENTS,
  TORONTO_PLACE,
  VANCOUVER_PLACE,
  WHOLESALE_JAR_CENTS,
  WHOLESALE_JAR_ON_HAND,
  WHOLESALE_SET_CENTS,
  productSeeds,
  regionSeeds,
} from "./catalog";
import { getDb } from "./index";
import { accounts, inventory, prices, products, regions } from "./schema";
import { makeReferralCode } from "../server/growth";

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
    await db
      .update(products)
      .set({ name: product.name, subtitle: product.subtitle, description: product.description })
      .where(eq(products.slug, product.slug));
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
  await db
    .update(regions)
    .set({
      enabled: true,
      venue: TORONTO_PLACE.venue,
      address: TORONTO_PLACE.address,
      hours: TORONTO_PLACE.hours,
      timeZone: TORONTO_PLACE.timeZone,
    })
    .where(eq(regions.slug, "toronto"));
  await db
    .update(regions)
    .set({
      enabled: true,
      venue: VANCOUVER_PLACE.venue,
      address: VANCOUVER_PLACE.address,
      hours: VANCOUVER_PLACE.hours || null,
      timeZone: VANCOUVER_PLACE.timeZone,
    })
    .where(eq(regions.slug, "vancouver"));

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

  const missingCodes = await db.select({ id: accounts.id }).from(accounts).where(isNull(accounts.referralCode));
  for (const account of missingCodes) {
    await db
      .update(accounts)
      .set({ referralCode: makeReferralCode() })
      .where(and(eq(accounts.id, account.id), isNull(accounts.referralCode)));
  }

  console.log("Seeded Élevé Select.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
