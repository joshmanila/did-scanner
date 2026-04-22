import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  campaigns,
  dialerDailyStats,
  didDailyStats,
  dids,
  dialers,
  syncRuns,
} from "@/db/schema";
import { createConvosoClientForDialer } from "@/lib/convoso/client";
import type { ConvosoCallLog } from "@/lib/convoso/types";
import {
  formatConvosoDate,
  nyDateString,
  parseConvosoDateAsUtcMs,
} from "@/lib/ny-time";
import { sendSyncFailureAlert } from "@/lib/alerts";

interface DidDailyBucket {
  did: string;
  areaCode: string;
  statDate: string;
  dials: number;
  answered: number;
  totalCallLengthSec: number;
  statusBreakdown: Record<string, number>;
}

interface DialerDailyBucket {
  statDate: string;
  totalDials: number;
  totalAnswered: number;
  totalCallLengthSec: number;
  uniqueDids: Set<string>;
}

interface CampaignSeen {
  id: string;
  name: string;
  lastSeen: number;
}

function cleanDid(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  if (digits.length === 10) return digits;
  return null;
}

export interface FullSyncResult {
  dialerId: string;
  syncRunId: string;
  pagesFetched: number;
  rowsProcessed: number;
  didCount: number;
  didDailyStatsCount: number;
  dialerDailyStatsCount: number;
  campaignsSeen: number;
  status: "success" | "failed";
  errorMessage?: string;
}

export async function runFullSync(
  dialerId: string,
  windowFrom: Date,
  windowTo: Date
): Promise<FullSyncResult> {
  const db = getDb();

  const dialerRows = await db
    .select()
    .from(dialers)
    .where(eq(dialers.id, dialerId));
  const dialer = dialerRows[0];
  if (!dialer) {
    throw new Error(`Dialer not found: ${dialerId}`);
  }

  const syncRunRows = await db
    .insert(syncRuns)
    .values({
      dialerId,
      kind: "overnight_full",
      status: "running",
      windowFrom,
      windowTo,
    })
    .returning({ id: syncRuns.id });
  const syncRunId = syncRunRows[0].id;

  try {
    const client = createConvosoClientForDialer(dialer);

    const didBuckets = new Map<string, DidDailyBucket>();
    const dialerBuckets = new Map<string, DialerDailyBucket>();
    const campaignMap = new Map<string, CampaignSeen>();
    let pagesFetched = 0;
    let rowsProcessed = 0;
    const diag = { callerIdHits: 0, fellBackToNumberDialed: 0, noDid: 0 };

    const iterator = client.streamCallLogs({
      start_date: formatConvosoDate(windowFrom),
      end_date: formatConvosoDate(windowTo),
      pageSize: 1000,
    });

    for await (const page of iterator) {
      pagesFetched += 1;
      for (const row of page.results) {
        rowsProcessed += 1;
        processRow(row, didBuckets, dialerBuckets, campaignMap, diag);
      }
    }
    console.log(
      `[sync/full] diag dialer=${dialer.name} rows=${rowsProcessed} callerIdHits=${diag.callerIdHits} fellBackToNumberDialed=${diag.fellBackToNumberDialed} noDid=${diag.noDid}`
    );

    const uniqueDids = new Set<string>();
    for (const bucket of didBuckets.values()) {
      uniqueDids.add(bucket.did);
    }

    const didIdMap = await upsertDids(dialerId, uniqueDids);
    await upsertDidDailyStats(didBuckets, didIdMap);
    await upsertDialerDailyStats(dialerId, dialerBuckets);
    await upsertCampaigns(dialerId, campaignMap);

    await db
      .update(syncRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        pagesFetched,
        rowsProcessed,
      })
      .where(eq(syncRuns.id, syncRunId));

    return {
      dialerId,
      syncRunId,
      pagesFetched,
      rowsProcessed,
      didCount: uniqueDids.size,
      didDailyStatsCount: didBuckets.size,
      dialerDailyStatsCount: dialerBuckets.size,
      campaignsSeen: campaignMap.size,
      status: "success",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(syncRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
      })
      .where(eq(syncRuns.id, syncRunId));
    void sendSyncFailureAlert({
      dialerId,
      dialerName: dialer.name,
      kind: "sync_failure_full",
      errorMessage: message,
    }).catch((e) => console.error("[sync/full] alert failed", e));
    return {
      dialerId,
      syncRunId,
      pagesFetched: 0,
      rowsProcessed: 0,
      didCount: 0,
      didDailyStatsCount: 0,
      dialerDailyStatsCount: 0,
      campaignsSeen: 0,
      status: "failed",
      errorMessage: message,
    };
  }
}

function processRow(
  row: ConvosoCallLog,
  didBuckets: Map<string, DidDailyBucket>,
  dialerBuckets: Map<string, DialerDailyBucket>,
  campaignMap: Map<string, CampaignSeen>,
  diag: { callerIdHits: number; fellBackToNumberDialed: number; noDid: number }
) {
  const fromCaller = cleanDid(row.caller_id_displayed);
  const fromDialed = fromCaller ? null : cleanDid(row.number_dialed);
  const did = fromCaller ?? fromDialed;
  if (!did) {
    diag.noDid += 1;
    return;
  }
  if (fromCaller) diag.callerIdHits += 1;
  else diag.fellBackToNumberDialed += 1;
  const areaCode = did.slice(0, 3);
  const callDateMs = parseConvosoDateAsUtcMs(row.call_date);
  const statDate = nyDateString(new Date(callDateMs));
  const lengthSec = parseInt(row.call_length ?? "0", 10) || 0;
  const answered = lengthSec > 0 ? 1 : 0;
  const status = (row.status_name || row.status || "UNKNOWN").trim() || "UNKNOWN";

  const didKey = `${did}|${statDate}`;
  const didBucket = didBuckets.get(didKey) ?? {
    did,
    areaCode,
    statDate,
    dials: 0,
    answered: 0,
    totalCallLengthSec: 0,
    statusBreakdown: {},
  };
  didBucket.dials += 1;
  didBucket.answered += answered;
  didBucket.totalCallLengthSec += lengthSec;
  didBucket.statusBreakdown[status] =
    (didBucket.statusBreakdown[status] ?? 0) + 1;
  didBuckets.set(didKey, didBucket);

  const dialerBucket = dialerBuckets.get(statDate) ?? {
    statDate,
    totalDials: 0,
    totalAnswered: 0,
    totalCallLengthSec: 0,
    uniqueDids: new Set<string>(),
  };
  dialerBucket.totalDials += 1;
  dialerBucket.totalAnswered += answered;
  dialerBucket.totalCallLengthSec += lengthSec;
  dialerBucket.uniqueDids.add(did);
  dialerBuckets.set(statDate, dialerBucket);

  if (row.campaign_id) {
    const existing = campaignMap.get(row.campaign_id);
    if (!existing || callDateMs > existing.lastSeen) {
      campaignMap.set(row.campaign_id, {
        id: row.campaign_id,
        name: row.campaign || row.campaign_id,
        lastSeen: callDateMs,
      });
    }
  }
}

async function upsertDids(
  dialerId: string,
  uniqueDids: Set<string>
): Promise<Map<string, string>> {
  const db = getDb();
  const didIdMap = new Map<string, string>();
  if (uniqueDids.size === 0) return didIdMap;
  const values = Array.from(uniqueDids).map((d) => ({
    dialerId,
    did: d,
    areaCode: d.slice(0, 3),
  }));

  const inserted = await db
    .insert(dids)
    .values(values)
    .onConflictDoUpdate({
      target: [dids.dialerId, dids.did],
      set: { areaCode: sql`excluded.area_code` },
    })
    .returning({ id: dids.id, did: dids.did });
  for (const r of inserted) {
    didIdMap.set(r.did, r.id);
  }
  return didIdMap;
}

async function upsertDidDailyStats(
  didBuckets: Map<string, DidDailyBucket>,
  didIdMap: Map<string, string>
) {
  if (didBuckets.size === 0) return;
  const db = getDb();
  const rows = Array.from(didBuckets.values())
    .map((b) => {
      const didId = didIdMap.get(b.did);
      if (!didId) return null;
      return {
        didId,
        statDate: b.statDate,
        dials: b.dials,
        answered: b.answered,
        totalCallLengthSec: b.totalCallLengthSec,
        statusBreakdown: b.statusBreakdown,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db
      .insert(didDailyStats)
      .values(chunk)
      .onConflictDoUpdate({
        target: [didDailyStats.didId, didDailyStats.statDate],
        set: {
          dials: sql`excluded.dials`,
          answered: sql`excluded.answered`,
          totalCallLengthSec: sql`excluded.total_call_length_sec`,
          statusBreakdown: sql`excluded.status_breakdown`,
        },
      });
  }
}

async function upsertDialerDailyStats(
  dialerId: string,
  dialerBuckets: Map<string, DialerDailyBucket>
) {
  if (dialerBuckets.size === 0) return;
  const db = getDb();
  const rows = Array.from(dialerBuckets.values()).map((b) => ({
    dialerId,
    statDate: b.statDate,
    totalDials: b.totalDials,
    totalAnswered: b.totalAnswered,
    totalCallLengthSec: b.totalCallLengthSec,
    wasDialing: b.totalDials > 0,
    uniqueDidsUsed: b.uniqueDids.size,
  }));

  await db
    .insert(dialerDailyStats)
    .values(rows)
    .onConflictDoUpdate({
      target: [dialerDailyStats.dialerId, dialerDailyStats.statDate],
      set: {
        totalDials: sql`excluded.total_dials`,
        totalAnswered: sql`excluded.total_answered`,
        totalCallLengthSec: sql`excluded.total_call_length_sec`,
        wasDialing: sql`excluded.was_dialing`,
        uniqueDidsUsed: sql`excluded.unique_dids_used`,
      },
    });
}

async function upsertCampaigns(
  dialerId: string,
  campaignMap: Map<string, CampaignSeen>
) {
  if (campaignMap.size === 0) return;
  const db = getDb();
  const rows = Array.from(campaignMap.values()).map((c) => ({
    dialerId,
    convosoCampaignId: c.id,
    name: c.name,
    lastSeenAt: new Date(c.lastSeen),
  }));
  await db
    .insert(campaigns)
    .values(rows)
    .onConflictDoUpdate({
      target: [campaigns.dialerId, campaigns.convosoCampaignId],
      set: {
        name: sql`excluded.name`,
        lastSeenAt: sql`excluded.last_seen_at`,
      },
    });
}

export async function runFullSyncForAllActive(
  windowFrom: Date,
  windowTo: Date
) {
  const db = getDb();
  const active = await db
    .select()
    .from(dialers)
    .where(eq(dialers.isActive, true));
  const results: FullSyncResult[] = [];
  for (const d of active) {
    const result = await runFullSync(d.id, windowFrom, windowTo);
    results.push(result);
  }
  return results;
}

export { eq, and };
