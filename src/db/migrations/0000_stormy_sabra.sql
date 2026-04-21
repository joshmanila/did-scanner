CREATE TYPE "public"."sync_kind" AS ENUM('overnight_full', 'live_pulse', 'manual');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "acid_list_dids" (
	"acid_list_id" uuid NOT NULL,
	"did" text NOT NULL,
	CONSTRAINT "acid_list_dids_acid_list_id_did_pk" PRIMARY KEY("acid_list_id","did")
);
--> statement-breakpoint
CREATE TABLE "acid_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dialer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dialer_id" uuid NOT NULL,
	"convoso_campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dialer_daily_stats" (
	"dialer_id" uuid NOT NULL,
	"stat_date" date NOT NULL,
	"total_dials" integer DEFAULT 0 NOT NULL,
	"total_answered" integer DEFAULT 0 NOT NULL,
	"total_call_length_sec" bigint DEFAULT 0 NOT NULL,
	"was_dialing" boolean DEFAULT false NOT NULL,
	"unique_dids_used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dialer_daily_stats_dialer_id_stat_date_pk" PRIMARY KEY("dialer_id","stat_date")
);
--> statement-breakpoint
CREATE TABLE "dialer_live_pulse" (
	"dialer_id" uuid PRIMARY KEY NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_hour_dials" integer DEFAULT 0 NOT NULL,
	"last_hour_answered" integer DEFAULT 0 NOT NULL,
	"last_hour_dids_used" integer DEFAULT 0 NOT NULL,
	"most_recent_call_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dialers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"convoso_api_url" text NOT NULL,
	"convoso_auth_token_encrypted" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "did_daily_stats" (
	"did_id" uuid NOT NULL,
	"stat_date" date NOT NULL,
	"dials" integer DEFAULT 0 NOT NULL,
	"answered" integer DEFAULT 0 NOT NULL,
	"total_call_length_sec" bigint DEFAULT 0 NOT NULL,
	"status_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "did_daily_stats_did_id_stat_date_pk" PRIMARY KEY("did_id","stat_date")
);
--> statement-breakpoint
CREATE TABLE "dids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dialer_id" uuid NOT NULL,
	"did" text NOT NULL,
	"area_code" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dialer_id" uuid NOT NULL,
	"kind" "sync_kind" NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"window_from" timestamp with time zone NOT NULL,
	"window_to" timestamp with time zone NOT NULL,
	"pages_fetched" integer DEFAULT 0 NOT NULL,
	"rows_processed" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "acid_list_dids" ADD CONSTRAINT "acid_list_dids_acid_list_id_acid_lists_id_fk" FOREIGN KEY ("acid_list_id") REFERENCES "public"."acid_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acid_lists" ADD CONSTRAINT "acid_lists_dialer_id_dialers_id_fk" FOREIGN KEY ("dialer_id") REFERENCES "public"."dialers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_dialer_id_dialers_id_fk" FOREIGN KEY ("dialer_id") REFERENCES "public"."dialers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialer_daily_stats" ADD CONSTRAINT "dialer_daily_stats_dialer_id_dialers_id_fk" FOREIGN KEY ("dialer_id") REFERENCES "public"."dialers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialer_live_pulse" ADD CONSTRAINT "dialer_live_pulse_dialer_id_dialers_id_fk" FOREIGN KEY ("dialer_id") REFERENCES "public"."dialers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "did_daily_stats" ADD CONSTRAINT "did_daily_stats_did_id_dids_id_fk" FOREIGN KEY ("did_id") REFERENCES "public"."dids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dids" ADD CONSTRAINT "dids_dialer_id_dialers_id_fk" FOREIGN KEY ("dialer_id") REFERENCES "public"."dialers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_dialer_id_dialers_id_fk" FOREIGN KEY ("dialer_id") REFERENCES "public"."dialers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_dialer_convoso_idx" ON "campaigns" USING btree ("dialer_id","convoso_campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dialers_name_idx" ON "dialers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "dids_dialer_did_idx" ON "dids" USING btree ("dialer_id","did");