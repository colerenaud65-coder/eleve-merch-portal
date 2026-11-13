import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const accountRole = pgEnum("account_role", [
  "popup_customer",
  "wholesale_applicant",
  "wholesale_buyer",
  "admin",
]);

export const accountStatus = pgEnum("account_status", [
  "pending",
  "approved",
  "suspended",
]);

export const regionChannel = pgEnum("region_channel", ["retail", "wholesale"]);

export const productKind = pgEnum("product_kind", [
  "selection",
  "jar",
  "selection_set",
]);

export const priceChannel = pgEnum("price_channel", ["retail", "wholesale"]);

export const orderKind = pgEnum("order_kind", ["preorder", "wholesale"]);

export const orderStatus = pgEnum("order_status", [
  "awaiting_deposit",
  "deposit_partial",
  "deposit_received",
  "ready_for_pickup",
  "completed",
  "cancelled",
]);

export const applicationStatus = pgEnum("application_status", [
  "pending",
  "approved",
  "declined",
]);

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  channel: regionChannel("channel").notNull(),
  minimumAge: integer("minimum_age").notNull(),
  timeZone: text("time_zone").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: accountRole("role").notNull().default("popup_customer"),
  status: accountStatus("status").notNull().default("pending"),
  regionId: uuid("region_id").references(() => regions.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  role: accountRole("role").notNull(),
  regionId: uuid("region_id").references(() => regions.id),
  token: text("token").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => accounts.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accessRequests = pgTable("access_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  city: text("city").notNull(),
  channel: text("channel").notNull(),
  note: text("note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wholesaleApplications = pgTable("wholesale_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone").notNull(),
  requestedRegionId: uuid("requested_region_id")
    .notNull()
    .references(() => regions.id),
  licenseNumber: text("license_number"),
  note: text("note"),
  status: applicationStatus("status").notNull().default("pending"),
  decidedBy: uuid("decided_by").references(() => accounts.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  regionId: uuid("region_id")
    .notNull()
    .references(() => regions.id),
  venue: text("venue").notNull(),
  city: text("city").notNull(),
  summary: text("summary").notNull(),
  timeZone: text("time_zone").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  preorderOpensAt: timestamp("preorder_opens_at", { withTimezone: true }).notNull(),
  preorderClosesAt: timestamp("preorder_closes_at", { withTimezone: true }).notNull(),
  complianceConfirmed: boolean("compliance_confirmed").notNull().default(false),
  complianceConfirmedAt: timestamp("compliance_confirmed_at", { withTimezone: true }),
  complianceNote: text("compliance_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Products carry no region, country, or currency.
 * Those live on regions, and therefore on events and prices.
 */
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: productKind("kind").notNull(),
  editionNumber: integer("edition_number"),
  editionSize: integer("edition_size"),
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull().default(""),
  imagePath: text("image_path"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const prices = pgTable(
  "prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    channel: priceChannel("channel").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (table) => [
    unique("prices_product_region_channel").on(table.productId, table.regionId, table.channel),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    onHand: integer("on_hand").notNull(),
    reserved: integer("reserved").notNull().default(0),
  },
  (table) => [unique("inventory_product_region").on(table.productId, table.regionId)],
);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  kind: orderKind("kind").notNull(),
  status: orderStatus("status").notNull().default("awaiting_deposit"),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  regionId: uuid("region_id")
    .notNull()
    .references(() => regions.id),
  eventId: uuid("event_id").references(() => events.id),
  currency: text("currency").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  depositRequiredCents: integer("deposit_required_cents").notNull(),
  depositReceivedCents: integer("deposit_received_cents").notNull().default(0),
  balanceCents: integer("balance_cents").notNull(),
  transferReference: text("transfer_reference").notNull().unique(),
  pickupToken: text("pickup_token").notNull().unique(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitAmountCents: integer("unit_amount_cents").notNull(),
  label: text("label").notNull(),
});

export const deposits = pgTable("deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull().default("etransfer"),
  reference: text("reference").notNull(),
  note: text("note"),
  recordedBy: uuid("recorded_by").references(() => accounts.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
