CREATE TABLE "contact_rate_entries" (
	"report_id" uuid NOT NULL,
	"did" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"contacts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contact_rate_entries_report_id_did_pk" PRIMARY KEY("report_id","did")
);
--> statement-breakpoint
CREATE TABLE "contact_rate_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dialer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"period_from" date,
	"period_to" date,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dialers" ADD COLUMN "active_contact_rate_report_id" uuid;--> statement-breakpoint
ALTER TABLE "contact_rate_entries" ADD CONSTRAINT "contact_rate_entries_report_id_contact_rate_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."contact_rate_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_rate_reports" ADD CONSTRAINT "contact_rate_reports_dialer_id_dialers_id_fk" FOREIGN KEY ("dialer_id") REFERENCES "public"."dialers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialers" ADD CONSTRAINT "dialers_active_contact_rate_report_id_contact_rate_reports_id_fk" FOREIGN KEY ("active_contact_rate_report_id") REFERENCES "public"."contact_rate_reports"("id") ON DELETE set null ON UPDATE no action;