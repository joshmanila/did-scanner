import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  pgEnum,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const dialers = pgTable(
  "dialers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    convosoApiUrl: text("convoso_api_url").notNull(),
    convosoAuthTokenEncrypted: text("convoso_auth_token_encrypted").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    activeAcidListId: uuid("active_acid_list_id").references(
      (): AnyPgColumn => acidLists.id,
      { onDelete: "set null" }
    ),
    activeContactRateReportId: uuid("active_contact_rate_report_id").references(
      (): AnyPgColumn => contactRateReports.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ nameIdx: uniqueIndex("dialers_name_idx").on(t.name) })
);

export const dids = pgTable(
  "dids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dialerId: uuid("dialer_id")
      .notNull()
      .references(() => dialers.id, { onDelete: "cascade" }),
    did: text("did").notNull(),
    areaCode: text("area_code").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("dids_dialer_did_idx").on(t.dialerId, t.did),
  })
);

export const acidLists = pgTable("acid_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  dialerId: uuid("dialer_id")
    .notNull()
    .references(() => dialers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const acidListDids = pgTable(
  "acid_list_dids",
  {
    acidListId: uuid("acid_list_id")
      .notNull()
      .references(() => acidLists.id, { onDelete: "cascade" }),
    did: text("did").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.acidListId, t.did] }) })
);

export const contactRateReports = pgTable("contact_rate_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  dialerId: uuid("dialer_id")
    .notNull()
    .references(() => dialers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  periodFrom: date("period_from"),
  periodTo: date("period_to"),
  totalCalls: integer("total_calls").notNull().default(0),
  totalContacts: integer("total_contacts").notNull().default(0),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contactRateEntries = pgTable(
  "contact_rate_entries",
  {
    reportId: uuid("report_id")
      .notNull()
      .references(() => contactRateReports.id, { onDelete: "cascade" }),
    did: text("did").notNull(),
    calls: integer("calls").notNull().default(0),
    contacts: integer("contacts").notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.reportId, t.did] }) })
);

export const didDailyStats = pgTable(
  "did_daily_stats",
  {
    didId: uuid("did_id")
      .notNull()
      .references(() => dids.id, { onDelete: "cascade" }),
    statDate: date("stat_date").notNull(),
    dials: integer("dials").notNull().default(0),
    answered: integer("answered").notNull().default(0),
    totalCallLengthSec: bigint("total_call_length_sec", { mode: "number" })
      .notNull()
      .default(0),
    statusBreakdown: jsonb("status_breakdown")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
  },
  (t) => ({ pk: primaryKey({ columns: [t.didId, t.statDate] }) })
);

export const dialerDailyStats = pgTable(
  "dialer_daily_stats",
  {
    dialerId: uuid("dialer_id")
      .notNull()
      .references(() => dialers.id, { onDelete: "cascade" }),
    statDate: date("stat_date").notNull(),
    totalDials: integer("total_dials").notNull().default(0),
    totalAnswered: integer("total_answered").notNull().default(0),
    totalCallLengthSec: bigint("total_call_length_sec", { mode: "number" })
      .notNull()
      .default(0),
    wasDialing: boolean("was_dialing").notNull().default(false),
    uniqueDidsUsed: integer("unique_dids_used").notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.dialerId, t.statDate] }) })
);

export const dialerLivePulse = pgTable("dialer_live_pulse", {
  dialerId: uuid("dialer_id")
    .notNull()
    .references(() => dialers.id, { onDelete: "cascade" })
    .primaryKey(),
  capturedAt: timestamp("captured_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastHourDials: integer("last_hour_dials").notNull().default(0),
  lastHourAnswered: integer("last_hour_answered").notNull().default(0),
  lastHourDidsUsed: integer("last_hour_dids_used").notNull().default(0),
  mostRecentCallAt: timestamp("most_recent_call_at", { withTimezone: true }),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dialerId: uuid("dialer_id")
      .notNull()
      .references(() => dialers.id, { onDelete: "cascade" }),
    convosoCampaignId: text("convoso_campaign_id").notNull(),
    name: text("name").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("campaigns_dialer_convoso_idx").on(
      t.dialerId,
      t.convosoCampaignId
    ),
  })
);

export const syncKind = pgEnum("sync_kind", [
  "overnight_full",
  "live_pulse",
  "manual",
]);
export const syncStatus = pgEnum("sync_status", [
  "running",
  "success",
  "failed",
]);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  dialerId: uuid("dialer_id")
    .notNull()
    .references(() => dialers.id, { onDelete: "cascade" }),
  kind: syncKind("kind").notNull(),
  status: syncStatus("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  windowFrom: timestamp("window_from", { withTimezone: true }).notNull(),
  windowTo: timestamp("window_to", { withTimezone: true }).notNull(),
  pagesFetched: integer("pages_fetched").notNull().default(0),
  rowsProcessed: integer("rows_processed").notNull().default(0),
  errorMessage: text("error_message"),
});

export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dialerId: uuid("dialer_id")
      .notNull()
      .references(() => dialers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex("alert_events_dialer_kind_idx").on(t.dialerId, t.kind),
  })
);

export type Dialer = typeof dialers.$inferSelect;
export type NewDialer = typeof dialers.$inferInsert;
export type Did = typeof dids.$inferSelect;
export type NewDid = typeof dids.$inferInsert;
export type DidDailyStat = typeof didDailyStats.$inferSelect;
export type DialerDailyStat = typeof dialerDailyStats.$inferSelect;
export type DialerLivePulse = typeof dialerLivePulse.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
export type AcidList = typeof acidLists.$inferSelect;
export type AlertEvent = typeof alertEvents.$inferSelect;
export type ContactRateReport = typeof contactRateReports.$inferSelect;
export type ContactRateEntry = typeof contactRateEntries.$inferSelect;
