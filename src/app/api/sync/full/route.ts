import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { dialers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { runFullSync } from "@/lib/sync/full";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const expected = process.env.VERCEL_CRON_SECRET;
  if (!expected) return true;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${expected}`) return true;
  if (request.headers.get("sec-fetch-site") === "same-origin") return true;
  return false;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dialerId = url.searchParams.get("dialerId");
  const windowFromParam = url.searchParams.get("windowFrom");
  const windowToParam = url.searchParams.get("windowTo");

  const windowTo = windowToParam ? new Date(windowToParam) : new Date();
  const defaultFrom = new Date(windowTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  const windowFrom = windowFromParam
    ? new Date(windowFromParam)
    : defaultFrom;

  const db = getDb();
  let targets;
  if (dialerId) {
    targets = await db
      .select()
      .from(dialers)
      .where(and(eq(dialers.id, dialerId), eq(dialers.isActive, true)));
  } else {
    targets = await db.select().from(dialers).where(eq(dialers.isActive, true));
  }

  const results = [];
  for (const d of targets) {
    const r = await runFullSync(d.id, windowFrom, windowTo);
    results.push(r);
  }

  return NextResponse.json({
    windowFrom: windowFrom.toISOString(),
    windowTo: windowTo.toISOString(),
    results,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
