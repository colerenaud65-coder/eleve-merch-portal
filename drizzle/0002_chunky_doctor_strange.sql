CREATE TABLE "box_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"number" integer NOT NULL,
	CONSTRAINT "box_allocations_event_number" UNIQUE("event_id","number")
);
--> statement-breakpoint
CREATE TABLE "drop_strains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"jar_on_hand" integer DEFAULT 0 NOT NULL,
	"jar_reserved" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "drop_strains_event_position" UNIQUE("event_id","position")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cancelled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "box_on_hand" integer DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "box_reserved" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "strain_position" integer;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "box_allocations" ADD CONSTRAINT "box_allocations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "box_allocations" ADD CONSTRAINT "box_allocations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_strains" ADD CONSTRAINT "drop_strains_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;