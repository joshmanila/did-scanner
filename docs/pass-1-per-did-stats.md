# DID Scanner — Pass 1 Engineering Spec

**Audience:** An autonomous coding agent (Claude Code) implementing this overnight without a human available. Every ambiguity should be resolved by this document. If a decision is missing, the "Decision defaults" section tells you how to proceed.

**Branch:** `claude/did-scanner-export-bh9Kz` (already exists, already checked out on the working copy).

**Scope summary:** Add per-DID performance analytics on top of today's area-code-level gap analysis, and add CSV export buttons to every result table. Keep the single-account, upload-driven UX. Do **not** add a database, auth, multi-account UI, or any write-back actions to Convoso. Those are Pass 2+.

---

## 1. Why

Today this app:

1. Parses a Convoso ACID-list CSV → groups DIDs by area code.
2. Pulls the call log via Convoso `/log/retrieve` → aggregates dial counts **by the lead's area code** (`phone_number`).
3. Joins #1 and #2 into a gap-analysis view (which area codes are under-covered).

Gaps in today's product:

- **Per-DID insight is missing.** The call log contains `number_dialed` (the DID used as caller ID on the call) in addition to `phone_number` (the lead). We aggregate the wrong side. Aggregating by `number_dialed` tells us which DIDs are actually being used, which are dormant, which are overworked.
- **No export.** Users have to screenshot tables to act on them.

Pass 1 fixes both. These are the two highest-leverage changes we can make without introducing a backend.

## 2. What Convoso exposes (hard constraints — do not design around endpoints that don't exist)

The Convoso auth-token ACL has been inspected. The available API sections are:

```
Agent Monitor Logout/Search, Agent Performance, Agent Productivity Search,
Call Log Search, Call Log Update,
Callback Delete/Insert/Search/Update,
Campaign Search, Campaign Status,
DNC Delete/Insert/Search/Update,
Lead Delete/Insert/Post/Recording Search/Search/Update/Validation,
List Delete/Insert/Search/Update,      ← lead lists, NOT ACID lists
Queue Update, Revenue Update/Insert,
SMSoptout Insert/Search/Update,
Status Insert/Search/Update,
User Activity/Recording Search/Search
```

**There is no DID, Inbound Number, Caller ID, or ACID List endpoint.** You cannot fetch DID membership, DID stage, or reputation from the API. Do not attempt endpoints like `/dids/*`, `/caller-ids/*`, `/inbound/*`. They do not exist on this auth-token scope.

The only API data we get in Pass 1 is what `/log/retrieve` already returns (`src/lib/convoso/types.ts` → `ConvosoCallLog`), notably `number_dialed`, `phone_number`, `call_date`, `call_length`, `status_name`, `campaign_id`, `campaign`.

## 3. Out of scope for Pass 1 (do not start these)

- Database, ORM, migrations, persistence.
- Multi-account UI. The `CONVOSO_AUTH_TOKEN` / `CONVOSO_API_URL` env-var pattern in `src/lib/convoso/client.ts` stays the only auth mechanism.
- Auth / login.
- Scheduled / cron / background sync.
- Any Convoso write endpoint.
- Any new map interactions — the map stays as-is (`src/components/did-map.tsx`).
- Campaign-level rollups (Campaign Search integration is Pass 2).
- Styling redesigns. Match the existing HUD aesthetic: mono font, `#39ff14` green / `#00bfff` blue, `text-glow-green`, `hud-divider`, `hud-grid-bg`, `hud-scanlines`, dark glass panels `bg-black/50 backdrop-blur border border-white/10 rounded-lg`.

## 4. Decision defaults (apply these when in doubt, do not ask)

| Question | Answer |
|---|---|
| Timezone for "last used at" | Treat Convoso's `call_date` as-is, display in the user's local timezone via `toLocaleString()`. Do not do timezone math. |
| How to detect "answered" | Use `call_length` parsed to number > 0. Ignore `status_name` for the answered flag (status taxonomy varies per account). |
| Utilization bands (rate-based) | Compute `dialsPerDay = dials / windowDays` where `windowDays = max(1, ceil((dateTo - dateFrom) / 1 day))`. Then: `dormant` when `dials === 0`; `underused` when `0 < dialsPerDay < 10`; `healthy` when `10 ≤ dialsPerDay ≤ 50`; `overused` when `dialsPerDay > 50`. Rationale: the business rule is "no DID should average more than 50 dials/day"; going over is a soft warning (spam-flag risk), not critical. |
| If `number_dialed` is empty/null on a log row | Skip the row for per-DID stats; still count it in area-code stats. |
| If `number_dialed` cleans to < 10 digits | Skip. |
| Cleaning rule | Strip non-digits, drop a leading `1` only when resulting length is 11. |
| ACID list CSV column for DIDs | Already handled by `src/lib/parse-dids.ts` — reuse `cleanPhoneNumber` and the same column-matching logic. |
| Inbound-Numbers CSV columns | Unknown exact headers. Use fuzzy match (case-insensitive, strip non-alphanumerics): phone column matches any of `did`, `phone`, `inboundnumber`, `number`, `callerid`; stage matches `stage`, `didstage`, `status`; reputation matches `reputation`, `score`; date added matches `dateadded`, `created`, `createdat`, `purchasedate`. Drop the row if no phone column can be identified; pass through everything else as optional enrichment. |
| CSV export library | Use `papaparse` (already a dependency) `Papa.unparse`. Trigger download via `Blob` + anchor-tag click, no new deps. |
| Export filename convention | `did-scanner-<view>-<YYYY-MM-DD>.csv`, e.g. `did-scanner-per-did-2026-04-21.csv`. Use local date. |

## 5. Fixture mode (REQUIRED — you cannot hit the real Convoso API during overnight build)

You will not have a real Convoso auth token. Add a fixture mode so you can validate end-to-end:

1. Create `src/lib/convoso/fixtures.ts` exporting a function `getFixtureCallLogs(): ConvosoLogResponse[]` that returns an array of `ConvosoLogResponse` pages (so pagination logic is exercised). Include:
   - At least 3 pages (2 full pages of 1000 + 1 partial page of ~150 = 2150 logs).
   - At least 30 distinct `number_dialed` values.
   - `phone_number`s spanning at least 20 distinct area codes (mix of covered + uncovered relative to a fixture ACID list).
   - A realistic mix of `call_length` values: some `"0"`, some `null`, some `"42"`, `"183"`, etc.
   - A mix of `status_name` values: `"HUMAN"`, `"MACHINE"`, `"NO_ANSWER"`, `"BUSY"`, `"DROP"`, `"DNC"`.
   - `call_date` values spread across the last 14 days.
   - Keep it deterministic (seedable or hardcoded). Do not use `Math.random()` at module load — that breaks snapshot-style validation.

2. In `src/lib/convoso/client.ts`, add a fixture short-circuit: if `process.env.CONVOSO_USE_FIXTURES === "true"`, `createConvosoClient()` returns a client whose `getCallLogs` pulls from `getFixtureCallLogs()` in page order. The real HTTP path is unchanged when the flag is off.

3. Create `docs/fixtures/sample-acid-list.csv` — a 200-row CSV in the shape that `parse-dids.ts` already accepts (header `Caller ID` works). Make sure the DIDs partially overlap with the fixture `number_dialed` values (so some DIDs show up as "in the list but dormant", some as "in the list and heavily used", some as "used on calls but not in the list").

4. Create `docs/fixtures/sample-inbound-numbers.csv` — a smaller CSV demonstrating the Inbound-Numbers enrichment parser. Include columns `DID`, `DID Stage`, `Reputation`, `Date Added`. Cover ~30 DIDs, overlap with the ACID list fixture.

With fixture mode on, `npm run dev` + uploading the sample ACID CSV + clicking Sync must produce a populated gap analysis AND per-DID view with no network calls to Convoso. This is the validation harness — if fixture mode doesn't yield a populated per-DID table, Pass 1 is not done.

## 6. Work breakdown (implement in this order)

### 6.1 Types — `src/lib/convoso/types.ts`

Add:

```ts
export interface PerDIDStats {
  did: string;              // 10-digit cleaned
  areaCode: string;         // first 3 of did
  dials: number;
  dialsPerDay: number;      // dials / windowDays, rounded to 1 decimal
  answered: number;         // call_length > 0
  avgCallLength: number;    // seconds, 0 if answered === 0
  lastUsedAt: string | null; // ISO string of latest call_date, null if never
  statusBreakdown: Record<string, number>; // status_name -> count
}

export type DIDUtilization = "dormant" | "underused" | "healthy" | "overused";
```

Do not modify `ConvosoCallLog` or `ConvosoLogResponse`.

### 6.2 Fixture plumbing — `src/lib/convoso/fixtures.ts` + `src/lib/convoso/client.ts`

Per section 5. Keep `client.ts` clean — the fixture check is a 5-line branch at the top of `createConvosoClient`, not scattered through the class.

### 6.3 Aggregator — `src/lib/did-stats.ts` (new file)

```ts
export function aggregatePerDID(logs: ConvosoCallLog[], windowDays: number): PerDIDStats[]
export function classifyUtilization(stats: PerDIDStats): DIDUtilization
```

- Iterate logs once, bucket by cleaned `number_dialed`.
- Skip rows where cleaned length < 10.
- `avgCallLength` divides by `answered`, not by `dials`; 0 when `answered === 0`.
- `dialsPerDay = Math.round((dials / windowDays) * 10) / 10` (one decimal).
- `classifyUtilization` implements the bands from §4 exactly — dormant / underused / healthy / overused.
- Sort result by `dials` descending.
- Add a second export `joinWithACIDList(stats: PerDIDStats[], acidListDIDs: string[]): { inList: PerDIDStats[]; onlyInCalls: PerDIDStats[]; onlyInList: string[] }` — this is the three-way Venn used by the UI.

Unit-testable as pure functions. No React. No fetch. No side effects.

### 6.4 API route — `src/app/api/convoso/did-stats/route.ts` (new)

Mirror the shape of the existing `call-distribution/route.ts`:

- Same pagination / parallel-page pattern (`PAGE_SIZE = 1000`, `PARALLEL_PAGES = 3`, `MAX_PAGES = 50`, `maxDuration = 60`).
- Same `dateFrom` / `dateTo` query params with same defaults.
- Differences: instead of bucketing by area code, build a `ConvosoCallLog[]` of every row and pass it through `aggregatePerDID(logs, windowDays)`.
- `windowDays` is computed from the parsed `dateFrom` / `dateTo` as `max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000))`.
- Response shape:
  ```ts
  {
    perDID: PerDIDStats[];
    totalCalls: number;        // total logs processed (pre-filter)
    uniqueDIDs: number;        // perDID.length
    windowDays: number;        // the denominator used for dialsPerDay
    dateFrom: string;
    dateTo: string;
    pagesProcessed: number;
  }
  ```

Do NOT delete or modify the existing `call-distribution` route. Both routes coexist. The UI will fan-out both calls from `handleSync` in parallel.

### 6.5 UI — new component `src/components/per-did-table.tsx`

Styled like `src/components/gap-analysis-table.tsx` (read that file first — copy structure, spacing, color tokens). Columns:

| Column | Notes |
|---|---|
| DID | 10-digit formatted `(aaa) bbb-cccc` |
| Area Code | From existing `area-codes.json` lookup for city/state if present |
| Dials | Number, right-aligned |
| Dials/Day | `dialsPerDay`, one decimal, right-aligned |
| Answered | Number + percentage (e.g. `182 (34%)`) |
| Avg Length | `mm:ss` |
| Last Used | `toLocaleString()` or "Never" |
| Status | Pill showing `dormant` / `underused` / `healthy` / `overused` — colors: dormant = `#ff3860` (red), underused = `#ffdd57` (yellow), healthy = `#39ff14` (existing green), overused = `#ff9500` (orange) |
| In ACID List | Check / dash. Passed in as a `Set<string>` prop for O(1) lookup. |

Sortable by every numeric column (click header). Default sort: `dials desc`. Simple client-side sort, no virtualization (≤ a few thousand rows is fine).

Top bar has a filter toggle row: `[All] [Dormant] [Underused] [Healthy] [Overused] [Only in list] [Only in calls, not in list]`. Single-select toggle, default All.

### 6.6 UI — export buttons

Create `src/lib/csv-export.ts`:

```ts
export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void
```

Uses `Papa.unparse` + `new Blob([...], { type: "text/csv" })` + hidden `<a download>` click. No deps added.

Wire an "Export CSV" button (same HUD styling, border color matches the view's accent — green for DID overview, blue for gap analysis, purple `#a020f0` for per-DID) into:

- `src/components/did-table.tsx` (area-code rollup from ACID list)
- `src/components/gap-analysis-table.tsx`
- `src/components/per-did-table.tsx`

Each export flattens the rows into a plain object per row with the same columns displayed (skip action/icon columns).

### 6.7 UI — page integration (`src/app/page.tsx`)

- Add a third view mode alongside `"dids" | "gap-analysis"`: `"per-did"`. Update the toggle bar accordingly. Accent color for the per-did tab: purple `#a020f0`, matching its table.
- When Sync is clicked, `Promise.all` both `/api/convoso/call-distribution` AND `/api/convoso/did-stats` (pass the same date range). Store both in state. Existing gap-analysis auto-compute continues to work on the call-distribution payload.
- After successful sync, default the view to `"per-did"` when `perDID.length > 0`, otherwise fall back to the previous behavior.
- Pass the ACID-list DID set into the per-DID table as a prop so the "In ACID List" column + "Only in list / Only in calls" filters work.

### 6.8 Optional Inbound-Numbers CSV enrichment

Add a second, optional upload component `src/components/inbound-numbers-upload.tsx`. Only shown after the primary ACID-list upload succeeds. Accepts a CSV, parses per section 4 fuzzy-match rules, merges rows into per-DID table state by 10-digit match. If the user doesn't upload one, skip silently — the `Stage`, `Reputation`, `Date Added` columns just don't appear.

When an enrichment file IS uploaded, the per-DID table grows three extra columns at the right edge: `Stage`, `Reputation`, `Date Added`.

### 6.9 Header copy (`src/app/page.tsx`)

Update tagline under the header to: `Convoso DID Performance & Gap Analysis`. Keep the `DID SCANNER` title and existing effects.

## 7. File checklist (what should exist after Pass 1)

New files:
- `src/lib/convoso/fixtures.ts`
- `src/lib/did-stats.ts`
- `src/lib/csv-export.ts`
- `src/app/api/convoso/did-stats/route.ts`
- `src/components/per-did-table.tsx`
- `src/components/inbound-numbers-upload.tsx`
- `docs/fixtures/sample-acid-list.csv`
- `docs/fixtures/sample-inbound-numbers.csv`

Modified files:
- `src/lib/convoso/types.ts` — add `PerDIDStats`, `DIDUtilization`
- `src/lib/convoso/client.ts` — fixture short-circuit
- `src/app/page.tsx` — third view, parallel sync, export wiring
- `src/components/did-table.tsx` — export button
- `src/components/gap-analysis-table.tsx` — export button

Do NOT modify: `src/lib/parse-dids.ts`, `src/lib/gap-analysis.ts`, `src/components/did-map.tsx`, `src/lib/area-codes.json`, `scripts/*`. If you think you need to, stop and document why in a code comment instead — it signals the spec missed something.

## 8. Acceptance criteria (must all pass before commit)

Run locally, in this exact order:

```bash
npm install
CONVOSO_USE_FIXTURES=true CONVOSO_API_URL=http://fixtures CONVOSO_AUTH_TOKEN=fixture npm run build
CONVOSO_USE_FIXTURES=true CONVOSO_API_URL=http://fixtures CONVOSO_AUTH_TOKEN=fixture npm run lint
```

Both must exit 0. No new ESLint warnings. No `any` introduced that wasn't already there.

Manual validation steps (you can run `npm run dev` in fixture mode and hit the endpoints with `curl` since you don't have a browser):

1. `curl 'http://localhost:3000/api/convoso/did-stats?dateFrom=2026-04-01%2000:00:00&dateTo=2026-04-21%2023:59:59'` returns JSON with `perDID.length >= 30`, `totalCalls >= 2000`, and a sane shape matching section 6.4.
2. `curl 'http://localhost:3000/api/convoso/call-distribution?…'` still works exactly as before (regression check).
3. Both routes return within 5 seconds in fixture mode.

## 9. Commit / PR hygiene

- One commit per numbered section of §6 is fine, or one logical commit per file cluster. Don't squash into a single giant commit.
- Messages: conventional-ish, e.g. `Add per-DID stats aggregator and route`, `Add CSV export utility and wire into tables`.
- Branch: `claude/did-scanner-export-bh9Kz` (already checked out).
- `git push -u origin claude/did-scanner-export-bh9Kz` when done.
- Do **not** open a PR. The user will do that after reviewing.

## 10. If you get stuck (flag-and-continue rules)

- If `npm install` fails due to network, retry up to 4 times with exponential backoff, then abort the run, commit any partial work with message `WIP: install failing`, and exit.
- If a fixture payload doesn't round-trip through the aggregator, print the offending row to stderr and move on — don't silently drop data.
- If the TypeScript compiler complains about a type you weren't expecting, resolve it honestly (add a proper type) — do **not** add `as any`, `@ts-ignore`, or widen to `unknown`-and-cast.
- If any decision feels ambiguous and isn't in §4, default to the smallest, most conservative change and add a single-line `// SPEC-UNCLEAR:` comment describing the question. Those comments are the only place ad-hoc commentary is welcome; everywhere else, no comments.

## 11. What this spec deliberately does NOT decide

These are Pass 2 concerns. If the implementing agent encounters them, stub only enough to make Pass 1 tests pass — do not build them:

- Persisting per-DID history across syncs.
- Per-campaign filtering.
- ACID-list-aware grouping (today we still treat the uploaded CSV as one flat list).
- Cross-account comparison.
- Convoso write-backs.

End of Pass 1 spec.
