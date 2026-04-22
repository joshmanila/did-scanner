import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dialers } from "@/db/schema";
import { createConvosoClientForDialer } from "@/lib/convoso/client";
import { formatConvosoDate } from "@/lib/ny-time";

export const dynamic = "force-dynamic";

function cleanDid(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dialerId = url.searchParams.get("dialerId");
  if (!dialerId) {
    return NextResponse.json(
      { error: "missing dialerId query param" },
      { status: 400 }
    );
  }

  const db = getDb();
  const dialerRows = await db
    .select()
    .from(dialers)
    .where(eq(dialers.id, dialerId));
  const dialer = dialerRows[0];
  if (!dialer) {
    return NextResponse.json({ error: "dialer not found" }, { status: 404 });
  }

  const client = createConvosoClientForDialer(dialer);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const page = await client.getCallLogs({
    start_date: formatConvosoDate(dayAgo),
    end_date: formatConvosoDate(now),
    limit: "20",
    offset: "0",
  });

  const rawResults = page.results ?? [];
  const firstRow = rawResults[0] ?? null;
  const allKeys = firstRow ? Object.keys(firstRow).sort() : [];
  const didLikeKeys = allKeys.filter((k) => {
    const lc = k.toLowerCase();
    return (
      lc.includes("caller") ||
      lc.includes("did") ||
      lc.includes("from") ||
      lc.includes("origin") ||
      lc.includes("source") ||
      lc.includes("number")
    );
  });

  const samples = rawResults.slice(0, 5).map((r) => {
    const rec = r as unknown as Record<string, unknown>;
    const sampleObj: Record<string, unknown> = {};
    for (const k of didLikeKeys) sampleObj[k] = rec[k];
    return {
      id: rec["id"],
      call_date: rec["call_date"],
      call_type: rec["call_type"],
      didLikeFields: sampleObj,
      cleanedFromCallerId: cleanDid(
        (rec["caller_id"] as string | null | undefined) ?? null
      ),
      cleanedFromNumberDialed: cleanDid(
        (rec["number_dialed"] as string | null | undefined) ?? null
      ),
    };
  });

  let callerIdPresent = 0;
  let callerIdNull = 0;
  for (const r of rawResults) {
    const rec = r as unknown as Record<string, unknown>;
    const v = rec["caller_id"];
    if (v === undefined || v === null || v === "") callerIdNull += 1;
    else callerIdPresent += 1;
  }

  return NextResponse.json(
    {
      dialerName: dialer.name,
      rowsReturned: rawResults.length,
      allKeysOnFirstRow: allKeys,
      didLikeKeys,
      callerIdPresent,
      callerIdNullOrMissing: callerIdNull,
      firstFiveSamples: samples,
    },
    { status: 200 }
  );
}
