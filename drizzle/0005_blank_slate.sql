CREATE TABLE IF NOT EXISTS "data_resets" (
	"name" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "venue" text;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "address" text;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "hours" text;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "data_resets" WHERE "name" = 'blank_slate_2026_11') THEN
		RETURN;
	END IF;

	DELETE FROM "points_ledger";
	DELETE FROM "claim_codes";
	DELETE FROM "redemptions";
	DELETE FROM "funnel_events"
	WHERE "event_id" IS NOT NULL
		OR "order_id" IN (SELECT "id" FROM "orders" WHERE "event_id" IS NOT NULL);
	DELETE FROM "box_allocations";
	DELETE FROM "deposits"
	WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "event_id" IS NOT NULL);
	DELETE FROM "order_lines"
	WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "event_id" IS NOT NULL);
	DELETE FROM "orders" WHERE "event_id" IS NOT NULL;
	DELETE FROM "waitlist_entries";
	DELETE FROM "selection_lineups";
	DELETE FROM "drop_strains";
	DELETE FROM "inventory"
	WHERE "region_id" IN (SELECT "id" FROM "regions" WHERE "channel" = 'retail');
	DELETE FROM "events";
	UPDATE "accounts" SET "points_balance" = 0, "lifetime_units" = 0;
	INSERT INTO "data_resets" ("name") VALUES ('blank_slate_2026_11');
END $$;
