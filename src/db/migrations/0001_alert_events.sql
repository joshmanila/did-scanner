CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dialer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_dialer_id_dialers_id_fk" FOREIGN KEY ("dialer_id") REFERENCES "public"."dialers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_events_dialer_kind_idx" ON "alert_events" USING btree ("dialer_id","kind");