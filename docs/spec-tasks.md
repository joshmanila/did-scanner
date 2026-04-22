# DID Scanner — Overnight Pass 1 Task List

Paired with `docs/spec.md`, `docs/spec-schema.md`, `docs/spec-ui.md`.

Work in this order. Each task has a file set + acceptance signal. If a task's acceptance signal doesn't hit, don't move on — fix it, or commit `WIP:` and flag in a `SPEC-UNCLEAR:` comment.

Small commits, descriptive messages, push at milestones.

## Pre-flight

- [ ] `git status` clean on branch `claude/did-scanner-export-bh9Kz`.
- [ ] `npm install` succeeds.
- [ ] Install new deps: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `postgres` (for non-Neon fallback). Dev dep: nothing else.

## Phase A — Infrastructure

### A1. Drizzle setup
- Create `drizzle.config.ts` at repo root.
- Create `src/db/schema.ts` per `spec-schema.md` §1.
- Create `src/db/client.ts` that exports a `db` instance using `drizzle(neon(DATABASE_URL))`.
- Add scripts to `package.json`: `"db:push": "drizzle-kit push"`, `"db:studio": "drizzle-kit studio"`.
- **Signal:** `npm run db:push` against a fresh Neon DB applies the schema with no errors.

### A2. Encryption
- `src/lib/crypto.ts` per `spec-schema.md` §3.
- **Signal:** roundtrip test `decryptToken(encryptToken("hello")) === "hello"` in a tiny `scripts/test-crypto.ts`, run with `ts-node` or `tsx`.

### A3. Fixture mode + Convoso client refactor
- Create `src/lib/convoso/fixtures.ts` per `spec.md` §6.
- Update `src/lib/convoso/client.ts`:
  - Export a `createConvosoClientForDialer(dialer)` that decrypts the token and instantiates a client. Old `createConvosoClient()` function stays, but is now only used by the legacy call-distribution route (which we'll delete in Phase C).
  - **Enforce outbound-only filter inside the client.** `getCallLogs` post-filters the `results` array to drop rows where `call_type === "INBOUND"` (compare case-insensitively). Never let inbound rows out of the client.
  - When `CONVOSO_USE_FIXTURES=true`, short-circuit to `getFixtureCallLogs()`.
- **Signal:** a small `scripts/test-fixture-client.ts` calls `getCallLogs()` and prints `{ totalPages, rowCount, inboundCount: 0 }`.

## Phase B — Sync

### B1. Queries helper
- `src/lib/queries.ts` — Drizzle query functions for:
  - `getAllDialers()`, `getDialerById(id)`, `getActiveDialers()`.
  - `getDialerDailyStats(dialerId, from, to)`.
  - `getDidDailyStatsForDialer(dialerId, from, to)` — joined with `dids`.
  - `getLivePulse(dialerId)`.
  - `getLastSyncRun(dialerId)`.
- **Signal:** types compile; unused functions are fine for Pass 1.

### B2. Sync logic
- `src/lib/sync/full.ts` — exported `runFullSync(dialerId, windowFrom, windowTo)`:
  1. Create `sync_runs` row, status=`running`.
  2. Stream Convoso call logs with pagination (same page size as today but with no `MAX_PAGES` cap — we want the whole window). After each page batch, upsert into in-memory daily buckets.
  3. On completion, transaction: upsert into `dids`, `did_daily_stats`, `dialer_daily_stats`, `campaigns`.
  4. Mark `sync_runs` row `success` with counters; on error, mark `failed` with the message.
- `src/lib/sync/pulse.ts` — exported `runLivePulse(dialerId)`:
  1. Pull last 90 minutes.
  2. Compute live metrics in memory.
  3. Upsert `dialer_live_pulse`.
  4. Also upsert today's `dialer_daily_stats` delta so dashboard "dials today" updates without waiting for overnight.
- **Signal:** running `runFullSync` against fixture mode populates all four tables with non-zero rows, end-to-end, with no live network calls.

### B3. Cron routes
- `src/app/api/sync/full/route.ts` — POST. Verifies `Authorization: Bearer ${VERCEL_CRON_SECRET}`. Reads optional `dialerId` query. If absent, loops over all active dialers. Calls `runFullSync` for each. Reports aggregate result JSON.
- `src/app/api/sync/pulse/route.ts` — same pattern, calls `runLivePulse`.
- **`vercel.json`** at repo root:
  ```json
  {
    "crons": [
      { "path": "/api/sync/full", "schedule": "0 2 * * *" },
      { "path": "/api/sync/pulse", "schedule": "*/5 * * * *" }
    ]
  }
  ```
- **Signal:** curl against the routes locally (with the bearer token) triggers a sync and writes data.

## Phase C — UI rewrite

### C1. Route skeleton
- Create the App Router tree per `spec-ui.md` §2.
- Top nav `src/components/nav/top-nav.tsx` + dialer picker. Keep the existing HUD look.
- Delete `src/app/api/convoso/call-distribution/route.ts` and `src/components/convoso-sync.tsx`.
- Update the old root `src/app/page.tsx` — it becomes the dashboard (see C2). The current upload-and-sync UX is gone from the home page; CSV uploads move to the ACID-lists sub-tab.
- **Signal:** `npm run build` passes. Navigating to `/`, `/settings`, `/dialer/[id]` renders placeholder content without errors.

### C2. Dashboard
- `src/components/dashboard/aggregate-strip.tsx` + `src/components/dashboard/dialer-card.tsx`.
- Server Component for the page, fetches via `queries.ts`. 30-second auto-refresh via a small client wrapper using `router.refresh()`.
- **Signal:** with fixture data seeded, the dashboard renders cards, numbers are non-zero, status dots evaluate.

### C3. Settings — dialers CRUD
- `/settings` page + `add-dialer-modal.tsx` + `edit-dialer-modal.tsx` + `dialers-table.tsx`.
- API routes: `POST /api/dialers`, `PATCH /api/dialers/[id]`, `DELETE /api/dialers/[id]`. These encrypt the token on write.
- **Signal:** manually create, edit, and delete a dialer via the UI against a live Neon DB.

### C4. Dialer detail — shared layout + Overview
- `src/app/dialer/[id]/layout.tsx` with sub-tab row.
- `src/app/dialer/[id]/page.tsx` — overview with headline numbers + top-10 lists.
- **Signal:** drilling into a fixture-seeded dialer shows real numbers.

### C5. Dialer detail — DIDs sub-tab
- `src/app/dialer/[id]/dids/page.tsx` with filter bar, sortable table, CSV export.
- `src/lib/csv-export.ts` for the download helper.
- **Signal:** all filters + sorts behave; exported CSV downloads with the correct filename and rows.

### C6. Dialer detail — Area Codes + Gap Analysis sub-tabs
- Port the existing components under the new routes. Adapt their inputs to DB-sourced rollups.
- Banner on Gap Analysis page noting the semantic change (area code of DIDs rather than leads). Short sentence, same HUD styling.
- **Signal:** both sub-tabs render maps / tables from DB data.

### C7. ACID Lists sub-tab
- `src/app/dialer/[id]/acid-lists/page.tsx` — upload form + existing-lists table.
- `POST /api/acid-lists`, `DELETE /api/acid-lists/[id]`.
- **Signal:** upload a sample CSV, see it listed, delete it, confirm cascade.

## Phase D — Seeding & polish

### D1. One-time seed migration
- In `src/db/seed.ts` (runnable via `tsx src/db/seed.ts`): if `dialers` is empty AND `CONVOSO_API_URL` + `CONVOSO_AUTH_TOKEN` env vars are set, insert a single dialer named `Default`. Also add an npm script `"db:seed": "tsx src/db/seed.ts"`.
- **Signal:** running against an empty DB seeds one row; running again is a no-op.

### D2. Remove temporary outbound-assertion log
- The assert-and-log check added in A3 to catch inbound rows leaking through stays in code, but its log is removed so production is quiet. The `throw` on inbound leakage stays.

### D3. Readme + env example
- Append a short "Running locally" section to `README.md` with:
  - Required env vars.
  - `npm run db:push`, `npm run dev`.
  - How to enable fixture mode.
- Create `.env.example` with all env var names (no values).
- **Signal:** a fresh clone following the README can boot in fixture mode.

## Acceptance (whole-run gate)

Before the final push:
- [ ] `npm run build` passes.
- [ ] `npm run lint` passes with zero new warnings.
- [ ] `CONVOSO_USE_FIXTURES=true` + a dev Neon DB: `npm run db:push` → manually add a dialer via `/settings` (token can be any string, it's fixture mode) → hit `/api/sync/full` with the cron bearer → `/` shows a populated card → `/dialer/<id>` shows populated numbers → all sub-tabs render → CSV exports download.
- [ ] Every new TypeScript file has no `any`, no `@ts-ignore`.
- [ ] All commits pushed to `claude/did-scanner-export-bh9Kz`.
- [ ] Final commit message summarizes what shipped and links any SPEC-UNCLEAR comments as a bullet list so the user can review them in one place.

## Deferred to later passes (do NOT build now)

- Convoso write-back (disable / replace / rotate / cancel).
- Per-campaign deep-dive analytics.
- "Lead-area-code" version of gap analysis (the pre-DB semantic).
- Multi-tenant auth.
- Data retention / cleanup crons.

---

# Pass 2 — Dashboard polish + reliability

Pairs with Pass 1 above. Same ground rules: small commits, acceptance signal per task, no `any`, no `@ts-ignore`. Build in order — each task is self-contained and shippable on its own.

## P2-1. Dashboard sparklines (dials/day, last 14 days)

- Extend `DialerCardData` in `src/lib/aggregates.ts` with `dialsLast14d: number[]` (length 14, oldest → newest, zero-filled for days with no stats row).
- Populate it in `computeDialerCard` with a single `dialer_daily_stats` query over `[today-13, today]`, then map into the zero-filled array using NY-time day strings (`nyDateStringDaysAgo`).
- New component `src/components/dashboard/sparkline.tsx` — pure SVG, no deps. Takes `{ values: number[]; color: string; width?: number; height?: number }`, renders a polyline + a faint area fill. Handles the `max === 0` case (flat line at the bottom).
- `src/components/dashboard/dialer-card.tsx` — render the sparkline between the headline grid and the "Last sync" footer. Color: `#39ff14`.
- **Signal:** dashboard with fixture data shows a 14-day line on each card; `npm run build` + `npm run lint` clean.

## P2-2. Status-dot threshold tuning (spec §Deferred placeholder-removal)

- Read `src/lib/status.ts` — document the current thresholds inline as constants at the top of the file (they're currently inlined in functions).
- Add a small table to `docs/spec.md` §5 listing each band (green / yellow / red) and the thresholds behind it, so product decisions are visible.
- No behavior change yet — this is a refactor-for-visibility step; the actual tuning PR comes after you've seen real production data.
- **Signal:** `grep THRESHOLD src/lib/status.ts` shows all bands as named exports; spec renders the table.

## P2-3. Sync-failure banner on dashboard

- New component `src/components/dashboard/sync-failure-banner.tsx` — dismissible banner that lists dialers whose **most recent** `sync_runs` row has `status === 'failed'` (not just last-successful-was-a-while-ago — specifically a fresh failure).
- Add `getDialersWithRecentSyncFailure()` to `src/lib/queries.ts`.
- Render at the top of `src/app/page.tsx` above `AggregateStrip`. Red HUD styling (`#ff003c`).
- Clicking a dialer name in the banner goes to `/dialer/<id>`.
- **Signal:** with a seeded `sync_runs` row having `status='failed'` for a dialer, dashboard shows the banner; with only successes, banner is absent.

## P2-4. Per-ACID-list filter on DIDs sub-tab

- Extend `DidRollup` query in `src/lib/queries.ts` to accept an optional `acidListId` and inner-join to `acid_list_dids` when provided.
- `src/components/dialer/per-did-table.tsx` — add a dropdown filter above the existing filter bar, populated from `getAcidListsForDialer(dialerId)`. Default: "All lists".
- URL-syncs as `?acidList=<id>` like the other filters.
- **Signal:** selecting a list narrows the table rows and CSV export to that list's DIDs only.

## P2-5. Alerting via email when sync fails

- Add `RESEND_API_KEY` + `ALERT_EMAIL_TO` env vars; wire a tiny `src/lib/alerts.ts` that sends via Resend's REST API (no SDK — one `fetch`).
- In `runFullSync` and `runLivePulse` (`src/lib/sync/*.ts`): on catch, after marking `sync_runs` failed, fire-and-forget an alert email. Dedupe by keeping state in a new `alert_events` table (dialer_id, kind, last_sent_at) — don't resend within 30 min.
- Silent no-op if env vars missing (local/dev).
- **Signal:** with env vars set and fixture client throwing, a run hits Resend once per 30-min window.

## Pass 2 acceptance gate

- [ ] `npm run build` passes.
- [ ] `npm run lint` passes with zero new warnings.
- [ ] Every new TypeScript file has no `any`, no `@ts-ignore`.
- [ ] All P2 commits pushed to `claude/did-scanner-export-bh9Kz`.
