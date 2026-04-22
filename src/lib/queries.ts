import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  acidListDids,
  acidLists,
  campaigns,
  dialerDailyStats,
  dialerLivePulse,
  dialers,
  didDailyStats,
  dids,
  syncRuns,
} from "@/db/schema";

export async function getAllDialers() {
  const db = getDb();
  return db.select().from(dialers).orderBy(dialers.name);
}

export async function getActiveDialers() {
  const db = getDb();
  return db
    .select()
    .from(dialers)
    .where(eq(dialers.isActive, true))
    .orderBy(dialers.name);
}

export async function getDialerById(id: string) {
  const db = getDb();
  const rows = await db.select().from(dialers).where(eq(dialers.id, id));
  return rows[0] ?? null;
}

export async function getDialerDailyStats(
  dialerId: string,
  fromDate: string,
  toDate: string
) {
  const db = getDb();
  return db
    .select()
    .from(dialerDailyStats)
    .where(
      and(
        eq(dialerDailyStats.dialerId, dialerId),
        gte(dialerDailyStats.statDate, fromDate),
        lte(dialerDailyStats.statDate, toDate)
      )
    )
    .orderBy(dialerDailyStats.statDate);
}

export async function getDidDailyStatsForDialer(
  dialerId: string,
  fromDate: string,
  toDate: string
) {
  const db = getDb();
  return db
    .select({
      didId: dids.id,
      did: dids.did,
      areaCode: dids.areaCode,
      firstSeenAt: dids.firstSeenAt,
      statDate: didDailyStats.statDate,
      dials: didDailyStats.dials,
      answered: didDailyStats.answered,
      totalCallLengthSec: didDailyStats.totalCallLengthSec,
      statusBreakdown: didDailyStats.statusBreakdown,
    })
    .from(dids)
    .leftJoin(didDailyStats, eq(dids.id, didDailyStats.didId))
    .where(
      and(
        eq(dids.dialerId, dialerId),
        sql`(${didDailyStats.statDate} IS NULL OR (${didDailyStats.statDate} >= ${fromDate} AND ${didDailyStats.statDate} <= ${toDate}))`
      )
    );
}

export async function getAllDidsForDialer(dialerId: string) {
  const db = getDb();
  return db.select().from(dids).where(eq(dids.dialerId, dialerId));
}

export async function getLivePulse(dialerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(dialerLivePulse)
    .where(eq(dialerLivePulse.dialerId, dialerId));
  return rows[0] ?? null;
}

export async function getAllLivePulses() {
  const db = getDb();
  return db.select().from(dialerLivePulse);
}

export async function getLastSyncRun(dialerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.dialerId, dialerId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLastSuccessfulSyncRun(dialerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(syncRuns)
    .where(
      and(eq(syncRuns.dialerId, dialerId), eq(syncRuns.status, "success"))
    )
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export interface RecentSyncFailure {
  dialerId: string;
  dialerName: string;
  errorMessage: string | null;
  failedAt: Date;
}

export async function getDialersWithRecentSyncFailure(): Promise<
  RecentSyncFailure[]
> {
  const active = await getActiveDialers();
  const latestPerDialer = await Promise.all(
    active.map(async (d) => {
      const last = await getLastSyncRun(d.id);
      return { dialer: d, last };
    })
  );
  const failures: RecentSyncFailure[] = [];
  for (const { dialer, last } of latestPerDialer) {
    if (last && last.status === "failed") {
      failures.push({
        dialerId: dialer.id,
        dialerName: dialer.name,
        errorMessage: last.errorMessage,
        failedAt: last.completedAt ?? last.startedAt,
      });
    }
  }
  return failures;
}

export async function getRecentSyncRuns(limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit);
}

export async function getCampaignsForDialer(dialerId: string) {
  const db = getDb();
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.dialerId, dialerId))
    .orderBy(desc(campaigns.lastSeenAt));
}

export async function getAcidListsForDialer(dialerId: string) {
  const db = getDb();
  const lists = await db
    .select()
    .from(acidLists)
    .where(eq(acidLists.dialerId, dialerId))
    .orderBy(desc(acidLists.uploadedAt));
  if (lists.length === 0) return [] as Array<{
    id: string;
    dialerId: string;
    name: string;
    uploadedAt: Date;
    didCount: number;
  }>;
  const listIds = lists.map((l) => l.id);
  const counts = await db
    .select({
      acidListId: acidListDids.acidListId,
      count: sql<number>`count(*)::int`,
    })
    .from(acidListDids)
    .where(inArray(acidListDids.acidListId, listIds))
    .groupBy(acidListDids.acidListId);
  const countMap = new Map(counts.map((c) => [c.acidListId, Number(c.count)]));
  return lists.map((l) => ({ ...l, didCount: countMap.get(l.id) ?? 0 }));
}

export async function getAcidListDids(acidListId: string) {
  const db = getDb();
  return db
    .select()
    .from(acidListDids)
    .where(eq(acidListDids.acidListId, acidListId));
}

export async function getAllAcidListDidsForDialer(
  dialerId: string
): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ did: acidListDids.did })
    .from(acidListDids)
    .innerJoin(acidLists, eq(acidListDids.acidListId, acidLists.id))
    .where(eq(acidLists.dialerId, dialerId));
  return new Set(rows.map((r) => r.did));
}

export async function getAcidListMembershipByDid(
  dialerId: string
): Promise<Record<string, string[]>> {
  const db = getDb();
  const rows = await db
    .select({
      did: acidListDids.did,
      acidListId: acidListDids.acidListId,
    })
    .from(acidListDids)
    .innerJoin(acidLists, eq(acidListDids.acidListId, acidLists.id))
    .where(eq(acidLists.dialerId, dialerId));
  const byDid: Record<string, string[]> = {};
  for (const r of rows) {
    (byDid[r.did] ??= []).push(r.acidListId);
  }
  return byDid;
}

export interface DidRollup {
  didId: string;
  did: string;
  areaCode: string;
  firstSeenAt: Date;
  totalDials: number;
  totalAnswered: number;
  totalCallLengthSec: number;
  lastUsedDate: string | null;
}

export async function getDidRollupForDialer(
  dialerId: string,
  fromDate: string,
  toDate: string
): Promise<DidRollup[]> {
  const db = getDb();
  const rows = await db
    .select({
      didId: dids.id,
      did: dids.did,
      areaCode: dids.areaCode,
      firstSeenAt: dids.firstSeenAt,
      totalDials: sql<number>`COALESCE(SUM(${didDailyStats.dials}), 0)::int`,
      totalAnswered: sql<number>`COALESCE(SUM(${didDailyStats.answered}), 0)::int`,
      totalCallLengthSec: sql<number>`COALESCE(SUM(${didDailyStats.totalCallLengthSec}), 0)::bigint`,
      lastUsedDate: sql<string | null>`MAX(${didDailyStats.statDate})::text`,
    })
    .from(dids)
    .leftJoin(
      didDailyStats,
      and(
        eq(dids.id, didDailyStats.didId),
        gte(didDailyStats.statDate, fromDate),
        lte(didDailyStats.statDate, toDate)
      )
    )
    .where(eq(dids.dialerId, dialerId))
    .groupBy(dids.id, dids.did, dids.areaCode, dids.firstSeenAt);
  return rows.map((r) => ({
    didId: r.didId,
    did: r.did,
    areaCode: r.areaCode,
    firstSeenAt: r.firstSeenAt,
    totalDials: Number(r.totalDials ?? 0),
    totalAnswered: Number(r.totalAnswered ?? 0),
    totalCallLengthSec: Number(r.totalCallLengthSec ?? 0),
    lastUsedDate: r.lastUsedDate,
  }));
}

export async function getActiveDialingDays(
  dialerId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dialerDailyStats)
    .where(
      and(
        eq(dialerDailyStats.dialerId, dialerId),
        eq(dialerDailyStats.wasDialing, true),
        gte(dialerDailyStats.statDate, fromDate),
        lte(dialerDailyStats.statDate, toDate)
      )
    );
  return Number(rows[0]?.count ?? 0);
}
