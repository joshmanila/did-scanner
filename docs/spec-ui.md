# DID Scanner — UI Layout & Screens

Paired with `docs/spec.md`. Styling stays on the existing HUD aesthetic: mono font, `#39ff14` green / `#00bfff` blue / `#a020f0` purple / `#ff9500` orange accents, dark glass panels (`bg-black/50 backdrop-blur border border-white/10 rounded-lg`), `hud-grid-bg`, `hud-scanlines`, `hud-divider`. Match `text-glow-green` for primary titles.

## 1. Top-level shape

```
┌────────────────────────────────────────────────────────┐
│  DID SCANNER                                           │
│  [ Dashboard ] [ Dialer: VMS ▾ ] [ Settings ]          │  ← top nav, always visible
├────────────────────────────────────────────────────────┤
│                                                        │
│   ( whatever you clicked above renders here )          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

Top nav is a single sticky header. The `Dialer:` menu is a dropdown of all rows from the `dialers` table. Selecting a dialer navigates to `/dialer/[id]`.

## 2. Routes

```
/                          Dashboard (all dialers)
/dialer/[id]               Dialer Overview (sub-tab: Overview)
/dialer/[id]/dids          Sub-tab: Per-DID table
/dialer/[id]/area-codes    Sub-tab: Area codes (map + table)
/dialer/[id]/gap-analysis  Sub-tab: Gap analysis
/dialer/[id]/acid-lists    Sub-tab: ACID list management (upload, manage)
/settings                  Dialers CRUD + sync config
```

Implement with Next.js App Router. `src/app/(dashboard)/page.tsx`, `src/app/dialer/[id]/layout.tsx` (renders the sub-tab row), `src/app/dialer/[id]/page.tsx` (overview), etc.

## 3. Dashboard screen (`/`)

**Purpose:** At-a-glance health across every dialer. Auto-refreshes every 30 seconds (client-side `setInterval` revalidation — no websocket).

Layout:

```
┌ TOP STRIP (aggregate numbers across all active dialers) ─────┐
│  Dials today        Contact rate today   DIDs over cap    … │
│  1,240,000          7.4%                  12                 │
└──────────────────────────────────────────────────────────────┘

┌ DIALER GRID (one card per active dialer, sortable) ──────────┐
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ VMS         │  │ Apollo      │  │ …           │           │
│  │ Dials: 840k │  │ Dials: 120k │  │             │           │
│  │ CR: 8.2%    │  │ CR: 5.1%    │  │             │           │
│  │ ● healthy   │  │ ● warning   │  │             │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

Each card shows:
- Dialer name (links to `/dialer/[id]`)
- Dials today (from `dialer_live_pulse.lastHourDials` × extrapolation? No — from `dialer_daily_stats` WHERE stat_date = today_NY + live pulse delta)
- Contact rate today
- Last-hour dials (from `dialer_live_pulse`)
- # DIDs over cap (30-day rolling)
- # dormant DIDs (30-day rolling)
- Active campaigns count
- Last sync timestamp with color: green if < 15 min ago, yellow < 2 h, red beyond
- Status dot: `healthy` (green), `warning` (orange), `error` (red). Thresholds documented below.

Default status-dot thresholds (tune via constants — easy to edit later, colors finalized in a later pass):
- `error` when last successful sync > 24 h ago, OR last-hour dials = 0 during business hours (8am–8pm NY).
- `warning` when 30-day contact rate dropped > 30% relative to prior 7-day average, OR DIDs over cap > 5.
- `healthy` otherwise.

Component: `src/components/dashboard/dialer-card.tsx`. Props are all typed aggregates coming from `queries.ts`.

## 4. Dialer detail — shared layout

`src/app/dialer/[id]/layout.tsx` renders:
- Dialer name + last-sync pill at the top.
- Sub-tab row: `[ Overview ] [ DIDs ] [ Area Codes ] [ Gap Analysis ] [ ACID Lists ]`
- Active tab styled in the same pattern as today's "DID Overview / Gap Analysis" toggle.
- Child route content below.

### 4.1 Overview (`/dialer/[id]`)

Headline numbers and a tiny set of top-N lists. No charts in this pass (deferred).

```
┌ HEADLINE ROW ────────────────────────────────────────┐
│ 30-day dials   30-day contact rate   Active dialing  │
│ 24,310,000     7.8%                  21 days         │
│                                                      │
│ Total DIDs     Dormant (30-day)      Over cap        │
│ 12,480         842                    47             │
└──────────────────────────────────────────────────────┘

┌ Top 10 DIDs by dials (30-day) ──────────────────────┐
┌ Top 10 most-dormant DIDs ────────────────────────────┐
┌ Top 10 over-cap DIDs ────────────────────────────────┐
```

Each top-10 row: DID, area code, dials (30-day), dials/day, status pill.

### 4.2 DIDs (`/dialer/[id]/dids`)

Full per-DID table — same spec as the previous Pass 1 design, now reading from `did_daily_stats` rolled up to the selected window (default last 30 days):

Columns: `DID`, `Area Code (City, State)`, `Dials`, `Dials/Day`, `Answered (n (x%))`, `Avg Length (mm:ss)`, `Last Used`, `Status pill`, `In ACID List`.

Filter bar at the top: `[All] [Dormant] [Underused] [Healthy] [Overused] [Only in list] [Only in calls, not in list]`. Search box for DID. Sort by any numeric column.

Status colors: dormant `#ff3860`, underused `#ffdd57`, healthy `#39ff14`, overused `#ff9500`.

"Export CSV" button in the top-right — uses `src/lib/csv-export.ts` (Papa.unparse → Blob → anchor click). Filename: `did-scanner-<dialer-name>-per-did-<YYYY-MM-DD>.csv`.

### 4.3 Area Codes (`/dialer/[id]/area-codes`)

Ports today's "DID Overview" feature (stats cards + map + table). Same components (`stats-cards.tsx`, `did-map.tsx`, `did-table.tsx`), now fed from `dids + did_daily_stats` instead of a freshly parsed CSV. Aggregation: group DIDs by area code, sum dials for the window. Plus an Export CSV button.

### 4.4 Gap Analysis (`/dialer/[id]/gap-analysis`)

Ports today's gap analysis, now fed from the database. Same `gap-analysis.ts` math, inputs come from:
- Call distribution: `SELECT area_code, SUM(dials) FROM did_daily_stats JOIN dids USING (…) WHERE … GROUP BY area_code` — treat each DID's dial count as falling into its own area code. (Note: this is a subtle change — old behavior grouped by the **lead's** area code from `phone_number`. We no longer store per-lead data. To preserve the old semantic, also store a `lead_area_code_daily_stats` table? No — defer that. The revised semantic is "calls sourced from area code X" which is arguably more actionable. Add a one-line banner on the gap analysis page explaining the change.)
- DID distribution: `SELECT area_code, COUNT(*) FROM dids WHERE dialer_id = ?` — unchanged in meaning.

Export CSV button.

### 4.5 ACID Lists (`/dialer/[id]/acid-lists`)

Upload + management UI. Two halves:

**Upload (top half):**
- Drop zone with a text field for "List name" (required).
- Accepts the same CSV format the app parses today.
- On upload: parse client-side (reuse `parse-dids.ts`), POST the `{ name, dids: string[] }` to a new route `/api/acid-lists` (POST). Server writes to `acid_lists` + `acid_list_dids`.

**Management (bottom half):**
- Table of existing ACID lists for this dialer: name, DID count, uploaded at, delete button (soft confirmation).
- Clicking a row shows the DIDs in that list with quick stats (dials/day, status) inline — same per-DID logic scoped to that list's membership.

The "In ACID List" column on the DIDs sub-tab means "in ANY of this dialer's ACID lists" in Pass 1. Filtering by a specific list is a later pass.

## 5. Settings (`/settings`)

Two sections:

### 5.1 Dialers

Table of rows from `dialers`:
- Name
- API URL (shown, editable)
- Token (masked, edit reveals an input; saving encrypts via `src/lib/crypto.ts` and updates the row)
- Active toggle (boolean — pauses syncs)
- Last sync time + status
- Delete button (destroys dialer + cascades all its data — require typed confirmation of dialer name)

"Add Dialer" button → modal with name + URL + token → POST to `/api/dialers`.

### 5.2 Sync configuration (read-only in this pass)

Displays the cron schedule pulled from `vercel.json`. Shows the most recent `sync_runs` rows across all dialers. Manual "Run Full Sync Now" button per dialer — hits `/api/sync/full?dialerId=…` with the cron secret.

## 6. Components inventory (new vs moved)

**New:**
- `src/components/nav/top-nav.tsx`
- `src/components/nav/dialer-picker.tsx`
- `src/components/dashboard/dialer-card.tsx`
- `src/components/dashboard/aggregate-strip.tsx`
- `src/components/dialer/overview.tsx`
- `src/components/dialer/sub-tab-row.tsx`
- `src/components/dialer/per-did-table.tsx`
- `src/components/dialer/top-n-list.tsx`
- `src/components/acid-lists/upload-form.tsx`
- `src/components/acid-lists/lists-table.tsx`
- `src/components/settings/dialers-table.tsx`
- `src/components/settings/add-dialer-modal.tsx`
- `src/components/settings/edit-dialer-modal.tsx`
- `src/lib/csv-export.ts`
- `src/lib/queries.ts`

**Moved / kept:**
- `src/components/did-table.tsx` — reused under Area Codes sub-tab.
- `src/components/stats-cards.tsx` — reused under Area Codes sub-tab.
- `src/components/did-map.tsx` — reused under Area Codes sub-tab.
- `src/components/gap-analysis-table.tsx` — reused under Gap Analysis sub-tab.
- `src/components/gap-stats-cards.tsx` — same.
- `src/components/csv-upload.tsx` — reused inside ACID Lists upload form.

**Deleted:**
- `src/components/convoso-sync.tsx` — the old "Sync with Convoso" button is gone. Sync is now automatic; manual runs live in Settings.
- `src/app/api/convoso/call-distribution/route.ts` — replaced by DB-backed reads.

## 7. State & data fetching

Server Components wherever possible — each sub-tab's page fetches its own data via Drizzle. No client-side caching library in this pass. The dashboard's 30-second refresh uses a tiny client component that re-fetches via `router.refresh()` on interval.

Loading states: skeleton cards (mono font, gray boxes) — ship with content-shape placeholders, not spinners.

## 8. Empty states

- No dialers yet: `/` redirects to `/settings` with an "Add your first dialer" card.
- Dialer exists but no syncs yet: Overview shows "Waiting for first sync. Next scheduled: …" pulled from `vercel.json`.
- Sub-tab with zero rows: a one-line "No data yet — check back after the next sync" in mono/dim.
