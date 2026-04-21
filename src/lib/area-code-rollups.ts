import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { didDailyStats, dids } from "@/db/schema";
import areaCodesData from "@/lib/area-codes.json";
import type {
  AreaCodeGroup,
  AreaCodeLookup,
  SummaryStats,
} from "@/lib/types";

const AREA_CODES = areaCodesData as AreaCodeLookup;

export async function getAreaCodeGroupsForDialer(
  dialerId: string,
  fromDate: string,
  toDate: string
): Promise<{ groups: AreaCodeGroup[]; stats: SummaryStats }> {
  const db = getDb();

  const didRows = await db
    .select({ did: dids.did, areaCode: dids.areaCode })
    .from(dids)
    .where(eq(dids.dialerId, dialerId));

  const callRows = await db
    .select({
      areaCode: dids.areaCode,
      totalDials: sql<number>`COALESCE(SUM(${didDailyStats.dials}), 0)::int`,
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
    .groupBy(dids.areaCode);

  const dialsByArea = new Map<string, number>();
  for (const r of callRows) {
    dialsByArea.set(r.areaCode, Number(r.totalDials));
  }

  const groupsByAc = new Map<string, AreaCodeGroup>();
  for (const r of didRows) {
    const info = AREA_CODES[r.areaCode];
    if (!info) continue;
    const existing = groupsByAc.get(r.areaCode);
    if (existing) {
      existing.count += 1;
      existing.dids.push(r.did);
    } else {
      groupsByAc.set(r.areaCode, {
        areaCode: r.areaCode,
        city: info.city,
        state: info.state,
        country: info.country,
        lat: info.lat,
        lng: info.lng,
        count: 1,
        dids: [r.did],
      });
    }
  }

  const groups = Array.from(groupsByAc.values()).sort(
    (a, b) => b.count - a.count
  );

  const stateBreakdown: Record<string, number> = {};
  let unmappedCount = 0;
  for (const r of didRows) {
    const info = AREA_CODES[r.areaCode];
    if (!info) {
      unmappedCount += 1;
      continue;
    }
    stateBreakdown[info.state] = (stateBreakdown[info.state] ?? 0) + 1;
  }

  const stats: SummaryStats = {
    totalDIDs: didRows.length,
    uniqueAreaCodes: groups.length,
    stateBreakdown,
    unmappedCount,
  };

  return {
    groups,
    stats,
  } as { groups: AreaCodeGroup[]; stats: SummaryStats } & {
    dialsByArea: Map<string, number>;
  };

}

export async function getCallDistributionByAreaCode(
  dialerId: string,
  fromDate: string,
  toDate: string
): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db
    .select({
      areaCode: dids.areaCode,
      totalDials: sql<number>`COALESCE(SUM(${didDailyStats.dials}), 0)::int`,
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
    .groupBy(dids.areaCode);
  const result: Record<string, number> = {};
  for (const r of rows) {
    const n = Number(r.totalDials);
    if (n > 0) result[r.areaCode] = n;
  }
  return result;
}
