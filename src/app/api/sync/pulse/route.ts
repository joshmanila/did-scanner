import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { dialers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { runLivePulse } from "@/lib/sync/pulse";

export const maxDuration = 60;

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
    const r = await runLivePulse(d.id);
    results.push(r);
  }
  return NextResponse.json({ results });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
