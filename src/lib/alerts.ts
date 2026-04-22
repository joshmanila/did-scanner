import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { alertEvents } from "@/db/schema";

const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_ADDRESS = "DID Scanner <alerts@did-scanner.app>";

export type AlertKind = "sync_failure_full" | "sync_failure_pulse";

export interface SyncFailureAlertInput {
  dialerId: string;
  dialerName: string;
  kind: AlertKind;
  errorMessage: string;
}

export async function sendSyncFailureAlert(
  input: SyncFailureAlertInput
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !to) return;

  const canSend = await reserveDedupeSlot(input.dialerId, input.kind);
  if (!canSend) return;

  const subject = `[DID Scanner] Sync failed — ${input.dialerName}`;
  const kindLabel =
    input.kind === "sync_failure_full"
      ? "Overnight full sync"
      : "Live pulse sync";
  const html = `
    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #111;">
      <h2 style="color: #b91c1c; margin: 0 0 8px 0;">${escapeHtml(subject)}</h2>
      <p><strong>Dialer:</strong> ${escapeHtml(input.dialerName)}</p>
      <p><strong>Kind:</strong> ${escapeHtml(kindLabel)}</p>
      <p><strong>Error:</strong></p>
      <pre style="background: #f3f4f6; padding: 12px; border-radius: 6px; white-space: pre-wrap;">${escapeHtml(
        input.errorMessage
      )}</pre>
      <p style="color: #6b7280; font-size: 12px;">
        This alert is deduped to once per 30 minutes per dialer/kind.
      </p>
    </div>
  `.trim();

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error(
        `[alerts] resend POST failed: ${res.status} ${await res.text()}`
      );
    }
  } catch (err) {
    console.error("[alerts] resend POST threw", err);
  }
}

async function reserveDedupeSlot(
  dialerId: string,
  kind: AlertKind
): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const cutoffIso = new Date(now.getTime() - DEDUPE_WINDOW_MS).toISOString();
  const updated = await db
    .update(alertEvents)
    .set({ lastSentAt: now })
    .where(
      and(
        eq(alertEvents.dialerId, dialerId),
        eq(alertEvents.kind, kind),
        sql`${alertEvents.lastSentAt} < ${cutoffIso}`
      )
    )
    .returning({ id: alertEvents.id });
  if (updated.length > 0) return true;

  const inserted = await db
    .insert(alertEvents)
    .values({ dialerId, kind, lastSentAt: now })
    .onConflictDoNothing({
      target: [alertEvents.dialerId, alertEvents.kind],
    })
    .returning({ id: alertEvents.id });
  return inserted.length > 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
