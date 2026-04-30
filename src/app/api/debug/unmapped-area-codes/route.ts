import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dids } from "@/db/schema";
import areaCodesData from "@/lib/area-codes.json";
import type { AreaCodeLookup } from "@/lib/types";

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

  const unmapped = rows
    .filter((r) => !AREA_CODES[r.areaCode])
    .map((r) => ({ areaCode: r.areaCode, didCount: Number(r.didCount) }))
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
