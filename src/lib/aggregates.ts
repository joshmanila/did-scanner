import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  campaigns,
  dialerDailyStats,
  dids,
  didDailyStats,
  syncRuns,
} from "@/db/schema";
import {
  getActiveAcidList,
  getActiveAcidListDids,
  getActiveContactRateByDid,
  getActiveContactRateReport,
  getActiveDialers,
  getLivePulse,
  getLastSuccessfulSyncRun,
  getActiveDialingDays,
} from "@/lib/queries";
import type { Dialer } from "@/db/schema";
import { nyDateStringDaysAgo, nyHour, nyTodayString } from "@/lib/ny-time";
import {
  dialerHealth,
  type DialerHealth,
  utilBand,
} from "@/lib/status";

const OVER_CAP_THRESHOLD = 50;

export interface DialerCardData {
  id: string;
  name: string;
  isActive: boolean;
  dialsToday: number;
  contactRateToday: number;
  lastHourDials: number;
  overCapCount: number;
  dormantCount: number;
  activeCampaigns: number;
  lastSyncAt: Date | null;
  lastSyncStatus: "success" | "failed" | "running" | null;
  health: DialerHealth;
  mostRecentCallAt: Date | null;
  dialsLast14d: number[];
}

const SPARKLINE_DAYS = 14;

export async function getDashboardAggregates() {
  const activeDialers = await getActiveDialers();
  const cards: DialerCardData[] = [];
  for (const d of activeDialers) {
    cards.push(await computeDialerCard(d));
  }

  const totalDialsToday = cards.reduce((sum, c) => sum + c.dialsToday, 0);
  const totalAnsweredToday = cards.reduce(
    (sum, c) => sum + c.dialsToday * c.contactRateToday,
    0
  );
  const contactRateToday =
    totalDialsToday > 0 ? totalAnsweredToday / totalDialsToday : 0;
  const overCapTotal = cards.reduce((sum, c) => sum + c.overCapCount, 0);
  const dormantTotal = cards.reduce((sum, c) => sum + c.dormantCount, 0);

  return {
    cards,
    totals: {
      dialsToday: totalDialsToday,
      contactRateToday,
      overCapTotal,
      dormantTotal,
      dialerCount: activeDialers.length,
    },
  };
}

async function computeDialerCard(d: Dialer): Promise<DialerCardData> {
  const db = getDb();
  const today = nyTodayString();
  const thirtyDaysAgo = nyDateStringDaysAgo(30);
  const sevenDaysAgo = nyDateStringDaysAgo(7);
  const priorStart = nyDateStringDaysAgo(14);
  const priorEnd = nyDateStringDaysAgo(7);
  const sparklineStart = nyDateStringDaysAgo(SPARKLINE_DAYS - 1);

  const [todayRows, pulse, lastSync, last30, prior7, sparkRows] = await Promise.all([
    db
      .select()
      .from(dialerDailyStats)
      .where(
        and(
          eq(dialerDailyStats.dialerId, d.id),
          eq(dialerDailyStats.statDate, today)
        )
      ),
    getLivePulse(d.id),
    getLastSuccessfulSyncRun(d.id),
    db
      .select({
        totalDials: sql<number>`COALESCE(SUM(${dialerDailyStats.totalDials}), 0)::int`,
        totalAnswered: sql<number>`COALESCE(SUM(${dialerDailyStats.totalAnswered}), 0)::int`,
      })
      .from(dialerDailyStats)
      .where(
        and(
          eq(dialerDailyStats.dialerId, d.id),
          gte(dialerDailyStats.statDate, thirtyDaysAgo),
          lte(dialerDailyStats.statDate, today)
        )
      ),
    db
      .select({
        totalDials: sql<number>`COALESCE(SUM(${dialerDailyStats.totalDials}), 0)::int`,
        totalAnswered: sql<number>`COALESCE(SUM(${dialerDailyStats.totalAnswered}), 0)::int`,
      })
      .from(dialerDailyStats)
      .where(
        and(
          eq(dialerDailyStats.dialerId, d.id),
          gte(dialerDailyStats.statDate, priorStart),
          lte(dialerDailyStats.statDate, priorEnd)
        )
      ),
    db
      .select({
        statDate: dialerDailyStats.statDate,
        totalDials: dialerDailyStats.totalDials,
      })
      .from(dialerDailyStats)
      .where(
        and(
          eq(dialerDailyStats.dialerId, d.id),
          gte(dialerDailyStats.statDate, sparklineStart),
          lte(dialerDailyStats.statDate, today)
        )
      ),
  ]);

  const todayRow = todayRows[0];
  const dialsToday = todayRow?.totalDials ?? 0;
  const answeredToday = todayRow?.totalAnswered ?? 0;
  const contactRateToday = dialsToday > 0 ? answeredToday / dialsToday : 0;

  const last30Totals = last30[0];
  const prior7Totals = prior7[0];
  const contactRate30d =
    last30Totals && Number(last30Totals.totalDials) > 0
      ? Number(last30Totals.totalAnswered) / Number(last30Totals.totalDials)
      : 0;
  const contactRatePrior7d =
    prior7Totals && Number(prior7Totals.totalDials) > 0
      ? Number(prior7Totals.totalAnswered) /
        Number(prior7Totals.totalDials)
      : 0;

  const [overCapCount, dormantCount, activeCampaigns] = await Promise.all([
    computeOverCapCount(d.id, thirtyDaysAgo, today),
    computeDormantCount(d.id, thirtyDaysAgo, today),
    computeActiveCampaigns(d.id, sevenDaysAgo),
  ]);

  const hour = nyHour(new Date());
  const health = dialerHealth({
    lastSuccessAt: lastSync?.completedAt ?? lastSync?.startedAt ?? null,
    lastHourDials: pulse?.lastHourDials ?? 0,
    nyHour: hour,
    overCapCount,
    contactRate30d,
    contactRatePrior7d,
  });

  const recentSync = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.dialerId, d.id))
    .orderBy(sql`${syncRuns.startedAt} desc`)
    .limit(1);
  const lastRun = recentSync[0];

  const dialsByDate = new Map<string, number>();
  for (const r of sparkRows) {
    dialsByDate.set(r.statDate, r.totalDials);
  }
  const dialsLast14d: number[] = [];
  for (let i = SPARKLINE_DAYS - 1; i >= 0; i--) {
    const dateStr = nyDateStringDaysAgo(i);
    dialsLast14d.push(dialsByDate.get(dateStr) ?? 0);
  }

  return {
    id: d.id,
    name: d.name,
    isActive: d.isActive,
    dialsToday,
    contactRateToday,
    lastHourDials: pulse?.lastHourDials ?? 0,
    overCapCount,
    dormantCount,
    activeCampaigns,
    lastSyncAt: lastRun?.completedAt ?? lastRun?.startedAt ?? null,
    lastSyncStatus: lastRun?.status ?? null,
    health,
    mostRecentCallAt: pulse?.mostRecentCallAt ?? null,
    dialsLast14d,
  };
}

async function computeOverCapCount(
  dialerId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ didId: didDailyStats.didId })
    .from(didDailyStats)
    .innerJoin(dids, eq(dids.id, didDailyStats.didId))
    .where(
      and(
        eq(dids.dialerId, dialerId),
        gte(didDailyStats.statDate, fromDate),
        lte(didDailyStats.statDate, toDate),
        sql`${didDailyStats.dials} > ${OVER_CAP_THRESHOLD}`
      )
    )
    .groupBy(didDailyStats.didId);
  return rows.length;
}

async function computeDormantCount(
  dialerId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      didId: dids.id,
      total: sql<number>`COALESCE(SUM(${didDailyStats.dials}), 0)::int`,
    })
    .from(dids)
    .leftJoin(
      didDailyStats,
      and(
        eq(didDailyStats.didId, dids.id),
        gte(didDailyStats.statDate, fromDate),
        lte(didDailyStats.statDate, toDate)
      )
    )
    .where(eq(dids.dialerId, dialerId))
    .groupBy(dids.id);
  return rows.filter((r) => Number(r.total) === 0).length;
}

async function computeActiveCampaigns(
  dialerId: string,
  fromDate: string
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.dialerId, dialerId),
        sql`${campaigns.lastSeenAt} >= ${fromDate}`
      )
    );
  return Number(rows[0]?.count ?? 0);
}

export interface DialerOverviewData {
  dialerId: string;
  totalDials30d: number;
  totalAnswered30d: number;
  contactRate30d: number;
  activeDays: number;
  totalDids: number;
  driftCount: number;
  hasActiveList: boolean;
  activeListName: string | null;
  activeListUploadedAt: Date | null;
  contactRateFromReport: number | null;
  reportCalls: number;
  reportContacts: number;
  reportName: string | null;
  reportUploadedAt: Date | null;
  reportPeriodFrom: string | null;
  reportPeriodTo: string | null;
  dormantCount: number;
  overCapCount: number;
  topByDials: Array<{
    didId: string;
    did: string;
    areaCode: string;
    totalDials: number;
    dialsPerDay: number;
    band: string;
    color: string;
  }>;
  topDormant: Array<{
    didId: string;
    did: string;
    areaCode: string;
    firstSeenAt: Date;
  }>;
  topOverCap: Array<{
    didId: string;
    did: string;
    areaCode: string;
    totalDials: number;
    dialsPerDay: number;
  }>;
}

export async function getDialerOverview(
  dialerId: string
): Promise<DialerOverviewData> {
  const db = getDb();
  const today = nyTodayString();
  const from = nyDateStringDaysAgo(30);

  const [totals, activeDays, didRollups, activeListDids, contactRateReport, activeList] = await Promise.all([
    db
      .select({
        totalDials: sql<number>`COALESCE(SUM(${dialerDailyStats.totalDials}), 0)::int`,
        totalAnswered: sql<number>`COALESCE(SUM(${dialerDailyStats.totalAnswered}), 0)::int`,
      })
      .from(dialerDailyStats)
      .where(
        and(
          eq(dialerDailyStats.dialerId, dialerId),
          gte(dialerDailyStats.statDate, from),
          lte(dialerDailyStats.statDate, today)
        )
      ),
    getActiveDialingDays(dialerId, from, today),
    db
      .select({
        didId: dids.id,
        did: dids.did,
        areaCode: dids.areaCode,
        firstSeenAt: dids.firstSeenAt,
        totalDials: sql<number>`COALESCE(SUM(${didDailyStats.dials}), 0)::int`,
        totalAnswered: sql<number>`COALESCE(SUM(${didDailyStats.answered}), 0)::int`,
        maxDaily: sql<number>`COALESCE(MAX(${didDailyStats.dials}), 0)::int`,
      })
      .from(dids)
      .leftJoin(
        didDailyStats,
        and(
          eq(didDailyStats.didId, dids.id),
          gte(didDailyStats.statDate, from),
          lte(didDailyStats.statDate, today)
        )
      )
      .where(eq(dids.dialerId, dialerId))
      .groupBy(dids.id, dids.did, dids.areaCode, dids.firstSeenAt),
    getActiveAcidListDids(dialerId),
    getActiveContactRateReport(dialerId),
    getActiveAcidList(dialerId),
  ]);

  const totalDials = Number(totals[0]?.totalDials ?? 0);
  const totalAnswered = Number(totals[0]?.totalAnswered ?? 0);
  const contactRate = totalDials > 0 ? totalAnswered / totalDials : 0;
  const hasActiveList = activeListDids.size > 0;

  const augmented = didRollups.map((r) => {
    const td = Number(r.totalDials);
    const perDay = activeDays > 0 ? td / activeDays : td;
    const band = utilBand(td, activeDays);
    return {
      didId: r.didId,
      did: r.did,
      areaCode: r.areaCode,
      firstSeenAt: r.firstSeenAt,
      totalDials: td,
      dialsPerDay: perDay,
      maxDaily: Number(r.maxDaily),
      band,
    };
  });

  const inList = hasActiveList
    ? augmented.filter((r) => activeListDids.has(r.did))
    : augmented;
  const driftCount = hasActiveList
    ? augmented.filter((r) => !activeListDids.has(r.did)).length
    : 0;

  const totalDids = hasActiveList ? activeListDids.size : augmented.length;

  const observedDidSet = new Set(augmented.map((r) => r.did));
  const neverObservedInListCount = hasActiveList
    ? Array.from(activeListDids).filter((d) => !observedDidSet.has(d)).length
    : 0;

  const dormantCount =
    inList.filter((r) => r.totalDials === 0).length + neverObservedInListCount;
  const overCapCount = inList.filter(
    (r) => r.maxDaily > OVER_CAP_THRESHOLD
  ).length;

  const topByDials = inList
    .filter((r) => r.totalDials > 0)
    .sort((a, b) => b.totalDials - a.totalDials)
    .slice(0, 10)
    .map((r) => ({
      didId: r.didId,
      did: r.did,
      areaCode: r.areaCode,
      totalDials: r.totalDials,
      dialsPerDay: r.dialsPerDay,
      band: r.band.band,
      color: r.band.color,
    }));

  const topDormant = inList
    .filter((r) => r.totalDials === 0)
    .slice(0, 10)
    .map((r) => ({
      didId: r.didId,
      did: r.did,
      areaCode: r.areaCode,
      firstSeenAt: r.firstSeenAt,
    }));

  const topOverCap = inList
    .filter((r) => r.maxDaily > OVER_CAP_THRESHOLD)
    .sort((a, b) => b.totalDials - a.totalDials)
    .slice(0, 10)
    .map((r) => ({
      didId: r.didId,
      did: r.did,
      areaCode: r.areaCode,
      totalDials: r.totalDials,
      dialsPerDay: r.dialsPerDay,
    }));

  const reportCalls = Number(contactRateReport?.totalCalls ?? 0);
  const reportContacts = Number(contactRateReport?.totalContacts ?? 0);
  const contactRateFromReport =
    contactRateReport && reportCalls > 0
      ? reportContacts / reportCalls
      : contactRateReport
        ? 0
        : null;

  return {
    dialerId,
    totalDials30d: totalDials,
    totalAnswered30d: totalAnswered,
    contactRate30d: contactRate,
    activeDays,
    totalDids,
    driftCount,
    hasActiveList,
    activeListName: activeList?.name ?? null,
    activeListUploadedAt: activeList?.uploadedAt ?? null,
    contactRateFromReport,
    reportCalls,
    reportContacts,
    reportName: contactRateReport?.name ?? null,
    reportUploadedAt: contactRateReport?.uploadedAt ?? null,
    reportPeriodFrom: contactRateReport?.periodFrom ?? null,
    reportPeriodTo: contactRateReport?.periodTo ?? null,
    dormantCount,
    overCapCount,
    topByDials,
    topDormant,
    topOverCap,
  };
}

export interface DidRowForTable {
  didId: string;
  did: string;
  areaCode: string;
  totalDials: number;
  dialsPerDay: number;
  totalAnswered: number;
  answeredPct: number;
  avgLengthSec: number;
  lastUsedDate: string | null;
  band: string;
  bandColor: string;
  bandLabel: string;
  inAcidList: boolean;
  reportCalls: number | null;
  reportContacts: number | null;
  reportContactRate: number | null;
}

export async function getDidRowsForDialer(
  dialerId: string,
  from: string,
  to: string,
  acidDidSet: Set<string>
): Promise<DidRowForTable[]> {
  const db = getDb();
  const [activeDays, reportByDid] = await Promise.all([
    getActiveDialingDays(dialerId, from, to),
    getActiveContactRateByDid(dialerId),
  ]);
  const rows = await db
    .select({
      didId: dids.id,
      did: dids.did,
      areaCode: dids.areaCode,
      totalDials: sql<number>`COALESCE(SUM(${didDailyStats.dials}), 0)::int`,
      totalAnswered: sql<number>`COALESCE(SUM(${didDailyStats.answered}), 0)::int`,
      totalCallLengthSec: sql<number>`COALESCE(SUM(${didDailyStats.totalCallLengthSec}), 0)::bigint`,
      lastUsedDate: sql<string | null>`MAX(${didDailyStats.statDate})::text`,
    })
    .from(dids)
    .leftJoin(
      didDailyStats,
      and(
        eq(didDailyStats.didId, dids.id),
        gte(didDailyStats.statDate, from),
        lte(didDailyStats.statDate, to)
      )
    )
    .where(eq(dids.dialerId, dialerId))
    .groupBy(dids.id, dids.did, dids.areaCode);

  return rows.map((r) => {
    const totalDials = Number(r.totalDials);
    const totalAnswered = Number(r.totalAnswered);
    const totalSec = Number(r.totalCallLengthSec);
    const band = utilBand(totalDials, activeDays);
    const report = reportByDid.get(r.did);
    return {
      didId: r.didId,
      did: r.did,
      areaCode: r.areaCode,
      totalDials,
      dialsPerDay: activeDays > 0 ? totalDials / activeDays : totalDials,
      totalAnswered,
      answeredPct: totalDials > 0 ? totalAnswered / totalDials : 0,
      avgLengthSec: totalAnswered > 0 ? totalSec / totalAnswered : 0,
      lastUsedDate: r.lastUsedDate,
      band: band.band,
      bandColor: band.color,
      bandLabel: band.label,
      inAcidList: acidDidSet.has(r.did),
      reportCalls: report?.calls ?? null,
      reportContacts: report?.contacts ?? null,
      reportContactRate: report?.contactRate ?? null,
    };
  });
}
