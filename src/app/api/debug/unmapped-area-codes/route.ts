import { NextResponse } from "next/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dids, didDailyStats } from "@/db/schema";
import areaCodesData from "@/lib/area-codes.json";
import type { AreaCodeLookup } from "@/lib/types";
import { nyDateStringDaysAgo } from "@/lib/ny-time";

const AREA_CODES = areaCodesData as AreaCodeLookup;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dialerId = url.searchParams.get("dialerId");
  if (!dialerId) {
    return NextResponse.json(
      { error: "dialerId query param required" },
      { status: 400 }
    );
  }
  const db = getDb();
  const rows = await db
    .select({
      areaCode: dids.areaCode,
      didCount: sql<number>`count(*)::int`,
    })
    .from(dids)
    .where(eq(dids.dialerId, dialerId))
    .groupBy(dids.areaCode);

  const unmappedAreaCodes = rows
    .filter((r) => !AREA_CODES[r.areaCode])
    .map((r) => r.areaCode);

  const samples = await db
    .select({
      areaCode: dids.areaCode,
      did: dids.did,
      firstSeenAt: dids.firstSeenAt,
      totalDials: sql<number>`COALESCE(SUM(${didDailyStats.dials}), 0)::int`,
    })
    .from(dids)
    .leftJoin(
      didDailyStats,
      and(
        eq(didDailyStats.didId, dids.id),
        gte(didDailyStats.statDate, nyDateStringDaysAgo(30))
      )
    )
    .where(
      and(
        eq(dids.dialerId, dialerId),
        unmappedAreaCodes.length > 0
          ? inArray(dids.areaCode, unmappedAreaCodes)
          : sql`false`
      )
    )
    .groupBy(dids.id, dids.areaCode, dids.did, dids.firstSeenAt);

  const samplesByAreaCode = new Map<
    string,
    Array<{ did: string; firstSeenAt: Date; totalDials: number }>
  >();
  for (const s of samples) {
    const arr = samplesByAreaCode.get(s.areaCode) ?? [];
    arr.push({
      did: s.did,
      firstSeenAt: s.firstSeenAt,
      totalDials: Number(s.totalDials),
    });
    samplesByAreaCode.set(s.areaCode, arr);
  }

  const unmapped = rows
    .filter((r) => !AREA_CODES[r.areaCode])
    .map((r) => ({
      areaCode: r.areaCode,
      didCount: Number(r.didCount),
      sampleDids: (samplesByAreaCode.get(r.areaCode) ?? [])
        .sort((a, b) => b.totalDials - a.totalDials)
        .slice(0, 5),
    }))
    .sort((a, b) => b.didCount - a.didCount);

  const totalUnmappedDids = unmapped.reduce((s, r) => s + r.didCount, 0);

  return NextResponse.json({
    dialerId,
    totalUniqueAreaCodes: rows.length,
    unmappedAreaCodeCount: unmapped.length,
    totalUnmappedDids,
    unmapped,
  });
}
