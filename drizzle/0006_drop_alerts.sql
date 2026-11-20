ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "unsubscribed_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drop_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"recipient_count" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "drop_alerts" ADD CONSTRAINT "drop_alerts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "drop_alerts" ADD CONSTRAINT "drop_alerts_sent_by_accounts_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drop_alerts_event_kind" ON "drop_alerts" USING btree ("event_id","kind");
