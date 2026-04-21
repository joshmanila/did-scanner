# DID Scanner — Database Schema & Aggregation Rules

Paired with `docs/spec.md`. Uses Drizzle ORM against Neon Postgres.

## 1. Drizzle schema — `src/db/schema.ts`

```ts
import { pgTable, uuid, text, timestamp, integer, bigint, boolean, date, jsonb, primaryKey, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";

// ── dialers ─────────────────────────────────────────────────────────────
export const dialers = pgTable("dialers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),                           // "VMS", "Apollo", …
  convosoApiUrl: text("convoso_api_url").notNull(),       // usually https://api.convoso.com/v1
  convosoAuthTokenEncrypted: text("convoso_auth_token_encrypted").notNull(), // AES-256-GCM ciphertext
  isActive: boolean("is_active").notNull().default(true), // pause syncs without deleting
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ nameIdx: uniqueIndex("dialers_name_idx").on(t.name) }));

// ── dids ────────────────────────────────────────────────────────────────
export const dids = pgTable("dids", {
  id: uuid("id").defaultRandom().primaryKey(),
  dialerId: uuid("dialer_id").notNull().references(() => dialers.id, { onDelete: "cascade" }),
  did: text("did").notNull(),                             // 10-digit cleaned
  areaCode: text("area_code").notNull(),                  // first 3 of did
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ unq: uniqueIndex("dids_dialer_did_idx").on(t.dialerId, t.did) }));

// ── acid_lists ──────────────────────────────────────────────────────────
export const acidLists = pgTable("acid_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  dialerId: uuid("dialer_id").notNull().references(() => dialers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                           // user-entered label, or CSV filename
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const acidListDids = pgTable("acid_list_dids", {
  acidListId: uuid("acid_list_id").notNull().references(() => acidLists.id, { onDelete: "cascade" }),
  did: text("did").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.acidListId, t.did] }) }));

// ── did_daily_stats ─────────────────────────────────────────────────────
export const didDailyStats = pgTable("did_daily_stats", {
  didId: uuid("did_id").notNull().references(() => dids.id, { onDelete: "cascade" }),
  statDate: date("stat_date").notNull(),                  // America/New_York day
  dials: integer("dials").notNull().default(0),
  answered: integer("answered").notNull().default(0),     // call_length > 0
  totalCallLengthSec: bigint("total_call_length_sec", { mode: "number" }).notNull().default(0),
  statusBreakdown: jsonb("status_breakdown").$type<Record<string, number>>().notNull().default({}),
}, (t) => ({ pk: primaryKey({ columns: [t.didId, t.statDate] }) }));

// ── dialer_daily_stats ──────────────────────────────────────────────────
export const dialerDailyStats = pgTable("dialer_daily_stats", {
  dialerId: uuid("dialer_id").notNull().references(() => dialers.id, { onDelete: "cascade" }),
  statDate: date("stat_date").notNull(),
  totalDials: integer("total_dials").notNull().default(0),
  totalAnswered: integer("total_answered").notNull().default(0),
  totalCallLengthSec: bigint("total_call_length_sec", { mode: "number" }).notNull().default(0),
  wasDialing: boolean("was_dialing").notNull().default(false), // any outbound call on this day
  uniqueDidsUsed: integer("unique_dids_used").notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.dialerId, t.statDate] }) }));

// ── dialer_live_pulse ───────────────────────────────────────────────────
// One row per dialer, overwritten every 5 min by the pulse job. Powers the "right now" dashboard.
export const dialerLivePulse = pgTable("dialer_live_pulse", {
  dialerId: uuid("dialer_id").notNull().references(() => dialers.id, { onDelete: "cascade" }).primaryKey(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  lastHourDials: integer("last_hour_dials").notNull().default(0),
  lastHourAnswered: integer("last_hour_answered").notNull().default(0),
  lastHourDidsUsed: integer("last_hour_dids_used").notNull().default(0),
  mostRecentCallAt: timestamp("most_recent_call_at", { withTimezone: true }),
});

// ── campaigns ───────────────────────────────────────────────────────────
export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  dialerId: uuid("dialer_id").notNull().references(() => dialers.id, { onDelete: "cascade" }),
  convosoCampaignId: text("convoso_campaign_id").notNull(),
  name: text("name").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ unq: uniqueIndex("campaigns_dialer_convoso_idx").on(t.dialerId, t.convosoCampaignId) }));

// ── sync_runs (audit log) ───────────────────────────────────────────────
export const syncKind = pgEnum("sync_kind", ["overnight_full", "live_pulse", "manual"]);
export const syncStatus = pgEnum("sync_status", ["running", "success", "failed"]);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  dialerId: uuid("dialer_id").notNull().references(() => dialers.id, { onDelete: "cascade" }),
  kind: syncKind("kind").notNull(),
  status: syncStatus("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  windowFrom: timestamp("window_from", { withTimezone: true }).notNull(),
  windowTo: timestamp("window_to", { withTimezone: true }).notNull(),
  pagesFetched: integer("pages_fetched").notNull().default(0),
  rowsProcessed: integer("rows_processed").notNull().default(0),
  errorMessage: text("error_message"),
});
```

## 2. Migration strategy

- Use `drizzle-kit push` for the overnight build — no hand-written migration SQL needed.
- Drizzle config lives at `drizzle.config.ts`, points at `src/db/schema.ts`, output dir `src/db/migrations`.
- Seed behavior: if `dialers` is empty AND `CONVOSO_API_URL` + `CONVOSO_AUTH_TOKEN` env vars exist, insert a single dialer named `"Default"` so the pre-existing single-account setup still works out of the box.

## 3. Credential encryption

- File: `src/lib/crypto.ts`
- AES-256-GCM.
- Key: 32 raw bytes derived from `APP_ENCRYPTION_KEY` (base64-decoded).
- Ciphertext format stored in DB: `base64(iv || ciphertext || authTag)`, all concatenated.
- Exported API: `encryptToken(plain: string): string` and `decryptToken(stored: string): string`.
- Fail loud on key missing or decryption error — do not log the plaintext.

## 4. Aggregation rules

All aggregation happens on data that has **already been filtered to outbound-only at the Convoso client layer.** If an inbound row is seen downstream, it is a bug — assert and drop.

### 4.1 `did_daily_stats` (per DID per day)

Bucket key: `(did_id, stat_date)`. `stat_date` is the America/New_York calendar date of the call's `call_date`.

For each call log row with non-empty `number_dialed`:
- `dials += 1`
- `answered += 1` if `parseInt(call_length, 10) > 0`
- `totalCallLengthSec += parseInt(call_length, 10) || 0`
- `statusBreakdown[status_name] += 1` (use string `"UNKNOWN"` for null/empty)

### 4.2 `dialer_daily_stats` (per dialer per day)

Same bucketing, but keyed by `(dialer_id, stat_date)`. Computed as a rollup over all DIDs for that dialer on that date, PLUS:
- `wasDialing = true` when at least one outbound call occurred on that day. Drives the denominator of "dials per day" (see §4.4).
- `uniqueDidsUsed` = count of distinct DIDs that had ≥1 dial on that date.

### 4.3 `dialer_live_pulse` (one row per dialer, right-now view)

Written by the live-pulse job. Values computed from the last 90 minutes of call logs (hard-coded), surfaced in the UI as "last hour" (close enough, and gives the pulse a safety margin for late-arriving rows).

- `lastHourDials` — count of outbound calls in the last 60 minutes.
- `lastHourAnswered` — count where `call_length > 0` in the last 60 minutes.
- `lastHourDidsUsed` — distinct `number_dialed` count in the last 60 minutes.
- `mostRecentCallAt` — max `call_date` seen this pulse.
- `capturedAt` — now().

### 4.4 Derived values (computed in SQL or TS from the stored tables — do NOT store)

| Derived | Formula | Source |
|---|---|---|
| Active dialing days in window | `COUNT(*) FROM dialer_daily_stats WHERE dialer_id = ? AND stat_date BETWEEN ? AND ? AND was_dialing = true` | dialer_daily_stats |
| Dials per day (for a DID) | `SUM(dials) / active_dialing_days_for_that_dialer_in_the_same_window` | did_daily_stats + the above |
| Utilization band | `dormant` if SUM(dials)=0, `underused` if 0 < dialsPerDay < 10, `healthy` if 10 ≤ dialsPerDay ≤ 50, `overused` if dialsPerDay > 50 | per DID |
| Contact rate (per dialer per day) | `totalAnswered / NULLIF(totalDials, 0)` | dialer_daily_stats |
| 30-day contact rate | `SUM(totalAnswered) / NULLIF(SUM(totalDials), 0) over last 30 days` | dialer_daily_stats |
| DIDs over cap (today) | DIDs with ≥1 day in the last 30 where that day's `dials > 50` | did_daily_stats |
| Dormant DIDs (30-day) | DIDs in the dialer with zero dials summed across the last 30 days | did_daily_stats + dids |

All of these live in `src/lib/queries.ts` as Drizzle query functions returning typed results. No business logic inside React components.

## 5. Indexes

Add these after the tables are working, measure first if unsure:
- `did_daily_stats (stat_date)` — dashboard reads today.
- `dialer_daily_stats (stat_date)` — same.
- `dids (dialer_id, area_code)` — area-code rollups.
- `sync_runs (dialer_id, started_at DESC)` — last-sync lookup.

## 6. Data retention

- `did_daily_stats` / `dialer_daily_stats` / `campaigns`: keep indefinitely in Pass 1. Decide retention when DB size gets meaningful.
- `sync_runs`: keep 90 days. Add a cleanup in a later pass; no cron for it yet.
- `dialer_live_pulse`: upsert, never accumulates — one row per dialer forever.
