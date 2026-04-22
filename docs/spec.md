# DID Scanner — Master Engineering Spec

**Branch:** `claude/did-scanner-export-bh9Kz`

**Audience:** An autonomous Claude Code agent building this overnight with no human available. Treat §3–§5 as settled decisions. When a detail is missing, pick the smallest-change option and add a `// SPEC-UNCLEAR:` comment so it can be reviewed later.

This master spec splits into three documents:

- `docs/spec.md` — this file: purpose, architecture, decisions, acceptance criteria.
- `docs/spec-schema.md` — database schema, aggregation rules.
- `docs/spec-ui.md` — UI layout, screens, component tree.
- `docs/spec-tasks.md` — ordered task list for Overnight Pass 1.

Read all four before starting.

---

## 1. Purpose

Multi-dialer DID management for Convoso. The app:

1. Connects to one or more Convoso accounts via auth token.
2. Pulls **outbound** call history overnight into a Postgres database.
3. Runs a lightweight "live pulse" sync every 5 minutes during the day.
4. Renders a multi-dialer dashboard (health at a glance) plus per-dialer drill-downs (DIDs, area codes, gap analysis, ACID lists).

Replaces today's single-account, upload-triggered, in-memory app. The existing CSV upload flow survives, but the primary data source becomes the database.

## 2. Non-Goals (do not build)

- Writing back to Convoso (disable / replace / rotate / cancel DIDs). Convoso does not expose a DID write API on the token scope we have.
- Multi-user auth. Single-seat internal tool. If hosted shared, put Vercel Password Protection in front — not in app scope.
- Other dialer vendors. Convoso only.
- Real-time streaming (WebSocket / SSE). "Semi-real-time" = 5-minute polling.
- Per-campaign rollups beyond listing campaigns on the dialer overview. Deeper campaign analytics is a later pass.

## 3. Stack & Infrastructure (settled)

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (already in use) | No change. |
| Database | Neon Postgres | Serverless, scales to zero, cheap, same engine Vercel Postgres wraps. |
| ORM / migrations | Drizzle ORM | Schema-in-TypeScript, first-class Neon support, fast. |
| Scheduled jobs | Vercel Cron | Built-in, declared in `vercel.json`. No extra infra. |
| Charts | None in this pass | Text + number cards only. Trend lines deferred. |
| Credential storage | Per-dialer rows in `dialers.convoso_auth_token`, encrypted at rest with AES-256-GCM using `APP_ENCRYPTION_KEY` from env | Token never appears in plaintext in the DB. |
| Dates/times | Store UTC in DB. Display in America/New_York (EST/EDT). Date bucketing for daily stats uses `America/New_York` day boundaries. | The business operates on NY time; aligns "today" semantics. |
| Outbound filter | Applied once at the Convoso client layer — every call_log query drops `call_type === 'INBOUND'` (and any future inbound synonyms) before returning. | Single source of truth, can't be bypassed. |

## 4. Architecture

```
  Convoso accounts  ──►  Vercel Cron  ──►  Sync routes  ──►  Postgres (Neon)
     (many)              - 02:00 UTC         - /api/sync/full              │
                          full daily          - /api/sync/pulse            │
                         - */5 * * * *                                     │
                          live pulse                                       ▼
                                                            Next.js UI  ──►  User
                                                            (Dashboard,
                                                             Dialer detail,
                                                             Settings)
```

- **Overnight full sync** runs at 02:00 UTC (≈ 10 pm EST / 11 pm EDT). For each dialer, pages through `/log/retrieve` for the last 30 days, writes raw-ish rollups to `did_daily_stats` and `dialer_daily_stats`. Idempotent — re-running the same day overwrites that day's rows.
- **Live pulse** runs every 5 minutes. For each dialer, pulls just the last 90 minutes of calls and updates **today's** row in `dialer_daily_stats` + a small `dialer_live_pulse` table. Does not backfill older days.
- **UI** never hits Convoso directly. Every read goes through Drizzle → Postgres. The old `/api/convoso/call-distribution` route gets deleted once the new flow is wired (it was the only direct path).

## 5. Environment Variables

```
DATABASE_URL              postgres://… (Neon pooled connection string)
APP_ENCRYPTION_KEY        32-byte base64 string used for AES-256-GCM of auth tokens
CONVOSO_USE_FIXTURES      "true" to short-circuit the Convoso client to fixture data (dev/testing)
VERCEL_CRON_SECRET        shared secret so cron routes can verify the caller is Vercel Cron
```

Drop the old `CONVOSO_API_URL` and `CONVOSO_AUTH_TOKEN` env vars once the dialer table is the source of truth. Keep them only as a one-time seeding fallback in migrations.

### 5.1 Status thresholds (dashboard)

All exported as named constants from `src/lib/status.ts`. Values are placeholders until enough production data exists to tune them. Changes here are product-level decisions — update this table when the constants move.

**Per-DID utilization band** (`utilBand`, based on average dials/day across the DID's active dialing days):

| Band | Rule | Color |
|---|---|---|
| `dormant` | total dials ≤ 0 | `#ff3860` red |
| `underused` | avg/day < `UTIL_UNDERUSED_MAX_PER_DAY` (10) | `#ffdd57` yellow |
| `healthy` | `UTIL_UNDERUSED_MAX_PER_DAY` ≤ avg/day ≤ `UTIL_HEALTHY_MAX_PER_DAY` (50) | `#39ff14` green |
| `overused` | avg/day > `UTIL_HEALTHY_MAX_PER_DAY` (50) | `#ff9500` orange |

**Dialer health dot** (`dialerHealth`, evaluated top-down — first match wins):

| Result | Rule |
|---|---|
| `error` | last successful sync > `HEALTH_STALE_SYNC_HOURS` (24) hours ago |
| `error` | NY hour is in `[HEALTH_BUSINESS_HOUR_START, HEALTH_BUSINESS_HOUR_END)` (8–20) **and** `lastHourDials === 0` |
| `warning` | `overCapCount > HEALTH_OVER_CAP_WARN_COUNT` (5) |
| `warning` | contact-rate drop vs prior-7d baseline > `HEALTH_CONTACT_RATE_DROP_WARN` (30%) |
| `healthy` | none of the above triggered |

## 6. Fixture mode (REQUIRED)

The overnight agent won't have live Convoso credentials. Implement fixture mode exactly as in the previous Pass 1 spec:

- `src/lib/convoso/fixtures.ts` exports `getFixtureCallLogs()` returning multi-page `ConvosoLogResponse[]` with ≥2150 synthetic logs, ≥30 distinct `number_dialed`, ≥20 distinct area codes, mix of `call_type` values (`OUTBOUND`, `MANUAL`, `INBOUND` — so the outbound filter can be exercised), `call_date` spread across the last 30 days, deterministic (no `Math.random()` at module load).
- `src/lib/convoso/client.ts` short-circuits to fixtures when `CONVOSO_USE_FIXTURES === "true"`.
- `docs/fixtures/sample-acid-list.csv` — 200-row CSV matching `parse-dids.ts` format, DIDs partially overlap with fixture `number_dialed`.

Fixture validation rule: with `CONVOSO_USE_FIXTURES=true`, the full sync route must populate the database end-to-end with no network calls.

## 7. Acceptance Criteria (master)

Each sub-spec has its own checklist. These are the overall gates:

1. `npm install && npm run build && npm run lint` all exit 0.
2. `DATABASE_URL=<neon-url> npx drizzle-kit push` applies the schema clean.
3. With `CONVOSO_USE_FIXTURES=true`, hitting `/api/sync/full` populates `dialers`, `dids`, `did_daily_stats`, and `dialer_daily_stats` with non-zero rows.
4. The dashboard route (`/`) renders without JavaScript errors against a fixture-seeded database.
5. Every drill-down sub-tab for a dialer renders against the same seed data.
6. Outbound-only filter is verifiable: add a temporary assertion log at the client layer that ensures zero `INBOUND`-typed rows reach aggregation. Remove the log before commit.

## 8. Commit hygiene

- Small, logical commits per task (not one giant squash).
- Conventional-ish messages (`Add dialers table and Drizzle schema`, `Wire dashboard to dialer_daily_stats`).
- Push to `claude/did-scanner-export-bh9Kz`.
- Do not open a PR. User will review manually.

## 9. Flag-and-continue rules

If any of these happen, don't block — commit partial progress with a clear message and move on:

- Neon connection fails during validation → commit schema + code, note in commit message that DB tests were skipped.
- TypeScript complains about a Drizzle type → resolve honestly (add a proper type). Never add `as any` or `@ts-ignore`.
- A decision is missing from any of the four spec docs → pick the smallest-change option, add `// SPEC-UNCLEAR: <question>` comment, keep going.
- Install retries (network hiccup) — up to 4 attempts with exponential backoff, then abort with `WIP: install failing` commit.

---

Next: read `docs/spec-schema.md`, then `docs/spec-ui.md`, then `docs/spec-tasks.md`.
