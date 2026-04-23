import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { contactRateEntries, contactRateReports } from "@/db/schema";
import { parseContactRateCsv } from "@/lib/contact-rate-parser";

interface UploadBody {
  dialerId?: string;
  name?: string;
  csv?: string;
  periodFrom?: string | null;
  periodTo?: string | null;
}

export async function POST(request: Request) {
  let body: UploadBody;
  try {
    body = (await request.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const dialerId = body.dialerId?.trim();
  const name = body.name?.trim();
  const csv = body.csv;
  if (!dialerId) {
    return NextResponse.json({ error: "dialerId required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "csv required" }, { status: 400 });
  }

  const parsed = parseContactRateCsv(csv);
  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    return NextResponse.json(
      { error: parsed.errors.join(" · ") },
      { status: 400 }
    );
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: "No valid DID rows found in the upload." },
      { status: 400 }
    );
  }

  const db = getDb();
  const reportRows = await db
    .insert(contactRateReports)
    .values({
      dialerId,
      name,
      periodFrom: body.periodFrom ?? null,
      periodTo: body.periodTo ?? null,
      totalCalls: parsed.totalCalls,
      totalContacts: parsed.totalContacts,
    })
    .returning({ id: contactRateReports.id });
  const reportId = reportRows[0].id;

  const CHUNK = 500;
  for (let i = 0; i < parsed.rows.length; i += CHUNK) {
    const chunk = parsed.rows.slice(i, i + CHUNK).map((r) => ({
      reportId,
      did: r.did,
      calls: r.calls,
      contacts: r.contacts,
    }));
    await db
      .insert(contactRateEntries)
      .values(chunk)
      .onConflictDoNothing({
        target: [contactRateEntries.reportId, contactRateEntries.did],
      });
  }

  return NextResponse.json({
    reportId,
    didCount: parsed.rows.length,
    totalCalls: parsed.totalCalls,
    totalContacts: parsed.totalContacts,
    skipped: parsed.skipped,
    warnings: parsed.errors,
  });
}
