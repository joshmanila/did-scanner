# Handoff — 2026-04-22

Picks up from session where Pass 1 + Pass 2 were merged to master and deployed, plus several post-deploy fixes. Read this before doing anything.

## Live state

- **Production URL:** `did-scanner.vercel.app` (Vercel project `info-28995871s-projects/did-scanner`, Neon DB attached)
- **Branch shipped to prod:** `master`
- **Last prod commit:** `7cdce8d` — "Fix pagination stopping early when inbound calls are in a page"
- **Vercel auto-deploys on push to `master`**

## What shipped today (in order)

1. Merged `claude/did-scanner-export-bh9Kz` → `master` (13 commits — specs + Phase A–D + Pass 2 P2-1 through P2-5)
2. `240649e` — Made dialer modals larger + scrollable on short viewports
3. `52654a9` — Portaled dialer modals to `document.body` so they overlay the whole page (backdrop-blur ancestor was trapping `position:fixed`)
4. `2f1b404` — Allowed same-origin sync triggers from the UI (the "Run Full Sync" button was 401'ing because it sends no Bearer token; now accepted via `sec-fetch-site: same-origin`)
5. `7cdce8d` — Fixed pagination stopping early: `streamCallLogs` was using the post-outbound-filter `page.results.length` to detect the last page, so any page with inbound calls ended the stream prematurely. Now uses `rawEntries` (pre-filter count)

## Open issues (confirmed, not yet fixed)

### 1. Contact rate is wrong (~92.8% on real data)

- Root cause: `src/lib/sync/full.ts:175` defines "answered" as `call_length > 0`, which counts voicemail, brief rings, AMD hits, etc. Everything with any duration.
- User confirmed the outbound-only filter is correctly applied — not the issue
- User wants contact rate **pulled from a Convoso report**, not computed from call logs
- **But:** Convoso has no public reports API (confirmed — see "Convoso API limits" below). So either:
  - (a) User pastes/uploads the report export periodically (manual), or
  - (b) We redefine "answered" based on specific Convoso `status` codes and compute it ourselves — user would need to list which codes count

### 2. DID count is wrong (937 unique values, should be the ACID list size)

- Root cause: `runFullSync` populates the `dids` table from every unique `number_dialed` in call logs. `number_dialed` is the **destination** (lead's phone), not the outbound DID. That's why the count was ~1:1 with total dials
- User wants the DID universe to be **the active ACID list**, not call-log-derived
- **Design agreed in principle** — drop call-log population of `dids`, source from a chosen ACID list per dialer
- **Not started** — pending the ACID sourcing decision below

## The blocker — ACID list sourcing

User wants a dropdown: "show me all my ACID lists from Convoso, let me pick the active one." This doesn't work directly because:

**Confirmed: Convoso has no public API for ACID lists.** Scanned the entire `API Menu Options Documentation`. Endpoints Convoso exposes publicly:

- Leads (insert/update/delete/search/get-recordings)
- Agent Performance (search)
- Call Logs (`/log/retrieve`, `/log/update`) — already using
- Callbacks (insert/search)
- Campaigns (status/search)
- Lists (insert/update/delete/search) — **lead lists, not ACID lists** (required `campaign_id`)
- Users (recordings/search)

Zero mentions of ACID, DID, caller_id, or area_code anywhere in their API docs. Same for any reports API.

**Three paths presented to user** (awaiting decision):

1. **Manual CSV upload, upgraded to first-class.** User exports ACID from Convoso UI ("Export List Based/Area Code Based Caller ID Numbers" article), uploads here, flags one list as "active" per dialer. Dashboard/DID views drive off active list. Drawback: stale between uploads (user asked about this — confirmed as the real tradeoff)
2. **Scrape Convoso admin URL via session cookie.** Capture the internal URL Convoso's own UI uses in DevTools, call it server-side with user's logged-in session cookie. Automated daily updates but fragile (breaks on Convoso UI changes), requires cookie rotation, uses a different auth than the public API
3. **Ask Convoso support for an undocumented/partner API.** Unknown timeline

**Claude recommended:** ship #1 today, fire off support ticket for #3 in parallel, fall back to #2 only if #3 fails. **User went to bed before deciding.**

## Next session — pick up here

Start by asking user: **"Which path do you want for ACID sourcing — (1) upgraded manual upload, (2) session-scrape, or (3) ask Convoso support first and wait?"**

Once decided:

### If path #1 (recommended)
- Add `active_acid_list_id uuid references acid_lists(id)` column to `dialers` table (new migration)
- Settings page: new "Active ACID list" dropdown per dialer row, pulling from that dialer's uploaded lists
- ACID Lists sub-tab (`/dialer/[id]/acid-lists`): add "Set Active" button per row, highlight the active one, add a prominent "Replace Active List" CTA
- Change `runFullSync`: stop populating `dids` from call logs. Instead, on sync start, sync `dids` table with `acid_list_dids` for the active list
- `per-did-table.tsx`, dashboard, overview: universe = active list's DIDs, not all-time call log DIDs
- Also decide: does sync drop historical stats for DIDs no longer in the active list, or preserve them? (Probably preserve — useful history)

### If path #2 (session-scrape)
- User needs to capture the Convoso internal URL via DevTools and paste it
- Add `convoso_session_cookie text encrypted` column to `dialers` (separate from `convoso_auth_token_encrypted`)
- Build `client.fetchAcidLists()` using that session cookie instead of the API token
- Settings UI needs a way for user to paste/update the session cookie when it expires

### Then separately, contact rate
After ACID sourcing is solved, circle back on the contact rate issue. Ask user:
- Can they paste the exact list of Convoso status codes that count as a "contact" in their report? (e.g. `A`, `SALE`, `HUMAN`, `XFER`, `CALLBK`)
- If yes, replace `answered = call_length > 0` with `answered = CONTACT_STATUSES.includes(status)` in `src/lib/sync/full.ts:175`

## Things NOT to revisit (already decided)

- ✅ Merge to master + prod deploy — done
- ✅ Modal sizing + portal — done
- ✅ Same-origin sync trigger auth — done
- ✅ Pagination bug — done
- ✅ Public Convoso API doesn't cover ACID — confirmed, don't re-investigate
- ✅ `number_dialed` is the destination not the outbound DID — confirmed
- ✅ Outbound-only filter is correct — not the contact rate bug

## Files to read first tomorrow

1. `docs/spec.md`, `docs/spec-tasks.md` — original overnight spec (context for the architecture)
2. `src/lib/sync/full.ts:175` — the `answered` definition that's wrong
3. `src/lib/convoso/client.ts` — where ACID fetch would go
4. `src/db/schema.ts` — `acid_lists`, `acid_list_dids` tables that exist, `dialers` table where `active_acid_list_id` would be added
5. `src/components/acid-lists/upload-form.tsx`, `src/app/api/acid-lists/route.ts` — existing CSV upload flow to extend

## Verification steps not yet done

- [ ] User has not clicked "Run Full Sync" after the pagination fix landed. Real dial count should explode from 946 to the true number. Worth verifying once before deeper work
- [ ] `[ RECENT SYNCS ]` should populate with the latest run's page + row count
