import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  dialerDailyStats,
  dialerLivePulse,
  dialers,
  syncRuns,
} from "@/db/schema";
import { createConvosoClientForDialer } from "@/lib/convoso/client";
import {
  formatConvosoDate,
  nyDateString,
  parseConvosoDateAsUtcMs,
} from "@/lib/ny-time";
import { sendSyncFailureAlert } from "@/lib/alerts";

const PULSE_WINDOW_MS = 90 * 60 * 1000;
const LAST_HOUR_MS = 60 * 60 * 1000;

export interface PulseResult {
  dialerId: string;
  syncRunId: string;
  rowsProcessed: number;
  status: "success" | "failed";
  errorMessage?: string;
}

export async function runLivePulse(dialerId: string): Promise<PulseResult> {
  const db = getDb();
  const dialerRows = await db
    .select()
    .from(dialers)
    .where(eq(dialers.id, dialerId));
  const dialer = dialerRows[0];
  if (!dialer) {
    throw new Error(`Dialer not found: ${dialerId}`);
  }

  const windowTo = new Date();
  const windowFrom = new Date(windowTo.getTime() - PULSE_WINDOW_MS);

  const runRows = await db
    .insert(syncRuns)
    .values({
      dialerId,
      kind: "live_pulse",
      status: "running",
      windowFrom,
      windowTo,
    })
    .returning({ id: syncRuns.id });
  const syncRunId = runRows[0].id;

  try {
    const client = createConvosoClientForDialer(dialer);

    let lastHourDials = 0;
    let lastHourAnswered = 0;
    const lastHourDidsSet = new Set<string>();
    let mostRecentCallMs: number | null = null;

    const todayStr = nyDateString(windowTo);
    let todayDials = 0;
    let todayAnswered = 0;
    let todayCallLengthSec = 0;
    const todayDidsSet = new Set<string>();

    const lastHourCutoff = windowTo.getTime() - LAST_HOUR_MS;
    let rowsProcessed = 0;

    const iterator = client.streamCallLogs({
      start_date: formatConvosoDate(windowFrom),
      end_date: formatConvosoDate(windowTo),
      pageSize: 1000,
    });

    for await (const page of iterator) {
      for (const row of page.results) {
        rowsProcessed += 1;
        const did = cleanDid(row.caller_id) ?? cleanDid(row.number_dialed);
        if (!did) continue;
        const callMs = parseConvosoDateAsUtcMs(row.call_date);
        const lengthSec = parseInt(row.call_length ?? "0", 10) || 0;
        const answered = lengthSec > 0 ? 1 : 0;

        if (callMs >= lastHourCutoff && callMs <= windowTo.getTime()) {
          lastHourDials += 1;
          lastHourAnswered += answered;
          lastHourDidsSet.add(did);
        }
        if (mostRecentCallMs === null || callMs > mostRecentCallMs) {
          mostRecentCallMs = callMs;
        }

        if (nyDateString(new Date(callMs)) === todayStr) {
          todayDials += 1;
          todayAnswered += answered;
          todayCallLengthSec += lengthSec;
          todayDidsSet.add(did);
        }
      }
    }

    await db
      .insert(dialerLivePulse)
      .values({
        dialerId,
        capturedAt: windowTo,
        lastHourDials,
        lastHourAnswered,
        lastHourDidsUsed: lastHourDidsSet.size,
        mostRecentCallAt: mostRecentCallMs
          ? new Date(mostRecentCallMs)
          : null,
      })
      .onConflictDoUpdate({
        target: dialerLivePulse.dialerId,
        set: {
          capturedAt: sql`excluded.captured_at`,
          lastHourDials: sql`excluded.last_hour_dials`,
          lastHourAnswered: sql`excluded.last_hour_answered`,
          lastHourDidsUsed: sql`excluded.last_hour_dids_used`,
          mostRecentCallAt: sql`excluded.most_recent_call_at`,
        },
      });

    await db
      .insert(dialerDailyStats)
      .values({
        dialerId,
        statDate: todayStr,
        totalDials: todayDials,
        totalAnswered: todayAnswered,
        totalCallLengthSec: todayCallLengthSec,
        wasDialing: todayDials > 0,
        uniqueDidsUsed: todayDidsSet.size,
      })
      .onConflictDoUpdate({
        target: [dialerDailyStats.dialerId, dialerDailyStats.statDate],
        set: {
          totalDials: sql`GREATEST(${dialerDailyStats.totalDials}, excluded.total_dials)`,
          totalAnswered: sql`GREATEST(${dialerDailyStats.totalAnswered}, excluded.total_answered)`,
          totalCallLengthSec: sql`GREATEST(${dialerDailyStats.totalCallLengthSec}, excluded.total_call_length_sec)`,
          wasDialing: sql`${dialerDailyStats.wasDialing} OR excluded.was_dialing`,
          uniqueDidsUsed: sql`GREATEST(${dialerDailyStats.uniqueDidsUsed}, excluded.unique_dids_used)`,
        },
      });

    await db
      .update(syncRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        pagesFetched: 0,
        rowsProcessed,
      })
      .where(eq(syncRuns.id, syncRunId));

    return {
      dialerId,
      syncRunId,
      rowsProcessed,
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
      kind: "sync_failure_pulse",
      errorMessage: message,
    }).catch((e) => console.error("[sync/pulse] alert failed", e));
    return {
      dialerId,
      syncRunId,
      rowsProcessed: 0,
      status: "failed",
      errorMessage: message,
    };
  }
}

function cleanDid(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

export async function runLivePulseForAllActive() {
  const db = getDb();
  const active = await db
    .select()
    .from(dialers)
    .where(eq(dialers.isActive, true));
  const results: PulseResult[] = [];
  for (const d of active) {
    results.push(await runLivePulse(d.id));
  }
  return results;
}
