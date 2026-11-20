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
  "on_terms",
]);

export const applicationStatus = pgEnum("application_status", [
  "pending",
  "approved",
  "declined",
]);

export const packageKind = pgEnum("package_kind", ["box", "jar"]);

export const rewardKind = pgEnum("reward_kind", ["hat", "tshirt", "hoodie"]);

export const redemptionStatus = pgEnum("redemption_status", ["pending", "fulfilled", "cancelled"]);

export const ledgerReason = pgEnum("ledger_reason", ["claim", "award", "redeem", "refund"]);

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
  enabled: boolean("enabled").notNull().default(true),
  venue: text("venue"),
  address: text("address"),
  hours: text("hours"),
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
  paymentTerms: text("payment_terms").notNull().default("deposit"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  referralCode: text("referral_code").unique(),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
  marketingRegionId: uuid("marketing_region_id").references(() => regions.id),
  lifetimeUnits: integer("lifetime_units").notNull().default(0),
  pointsBalance: integer("points_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => accounts.id),
    referredId: uuid("referred_id")
      .notNull()
      .references(() => accounts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("referrals_referred").on(table.referredId)],
);

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
  earlyAccessOpensAt: timestamp("early_access_opens_at", { withTimezone: true }),
  complianceConfirmed: boolean("compliance_confirmed").notNull().default(false),
  complianceConfirmedAt: timestamp("compliance_confirmed_at", { withTimezone: true }),
  complianceNote: text("compliance_note"),
  cancelled: boolean("cancelled").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  boxOnHand: integer("box_on_hand").notNull().default(16),
  boxReserved: integer("box_reserved").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dropStrains = pgTable(
  "drop_strains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull().default(""),
    jarOnHand: integer("jar_on_hand").notNull().default(0),
    jarReserved: integer("jar_reserved").notNull().default(0),
  },
  (table) => [unique("drop_strains_event_position").on(table.eventId, table.position)],
);

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

export const selectionLineups = pgTable(
  "selection_lineups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    lineup: text("lineup").notNull().default(""),
  },
  (table) => [unique("selection_lineups_event_product").on(table.eventId, table.productId)],
);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("waitlist_event_account").on(table.eventId, table.accountId)],
);

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
  paymentTerms: text("payment_terms").notNull().default("deposit"),
  holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boxAllocations = pgTable(
  "box_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
  },
  (table) => [unique("box_allocations_event_number").on(table.eventId, table.number)],
);

export const funnelEvents = pgTable(
  "funnel_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    accountId: uuid("account_id").references(() => accounts.id),
    eventId: uuid("event_id").references(() => events.id),
    orderId: uuid("order_id").references(() => orders.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("funnel_events_step").on(table.accountId, table.eventId, table.name)],
);

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
  strainPosition: integer("strain_position"),
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

export const claimCodes = pgTable("claim_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  packageKind: packageKind("package_kind").notNull(),
  eventId: uuid("event_id").references(() => events.id),
  batchId: uuid("batch_id").notNull(),
  claimedBy: uuid("claimed_by").references(() => accounts.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redemptions = pgTable("redemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  reward: rewardKind("reward").notNull(),
  points: integer("points").notNull(),
  status: redemptionStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const dataResets = pgTable("data_resets", {
  name: text("name").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pointsLedger = pgTable("points_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  deltaPoints: integer("delta_points").notNull(),
  deltaUnits: integer("delta_units").notNull().default(0),
  reason: ledgerReason("reason").notNull(),
  claimCodeId: uuid("claim_code_id").references(() => claimCodes.id),
  redemptionId: uuid("redemption_id").references(() => redemptions.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
