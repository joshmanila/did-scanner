import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  dialerDailyStats,
  dialerLivePulse,
  dids,
} from "@/db/schema";

// Wipes per-dialer call-log-derived state so a fresh runFullSync rebuilds it.
// Does NOT touch acid_lists, contact_rate_reports, dialers, or sync_runs.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  // dids cascades to did_daily_stats via FK
  const didDelete = await db
    .delete(dids)
    .where(eq(dids.dialerId, id))
    .returning({ id: dids.id });
  await db.delete(dialerDailyStats).where(eq(dialerDailyStats.dialerId, id));
  await db.delete(dialerLivePulse).where(eq(dialerLivePulse.dialerId, id));
  return NextResponse.json({
    didsDeleted: didDelete.length,
  });
}
