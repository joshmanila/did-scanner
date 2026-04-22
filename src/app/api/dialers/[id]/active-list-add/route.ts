import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { acidListDids, dialers } from "@/db/schema";

function cleanDid(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { dids?: string[] };
  try {
    body = (await request.json()) as { dids?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.dids) || body.dids.length === 0) {
    return NextResponse.json(
      { error: "dids must be a non-empty array" },
      { status: 400 }
    );
  }

  const db = getDb();
  const dialerRows = await db
    .select({ activeAcidListId: dialers.activeAcidListId })
    .from(dialers)
    .where(eq(dialers.id, id));
  const activeId = dialerRows[0]?.activeAcidListId;
  if (!activeId) {
    return NextResponse.json(
      { error: "Dialer has no active ACID list." },
      { status: 400 }
    );
  }

  const cleaned = Array.from(
    new Set(
      body.dids
        .map((d) => cleanDid(d))
        .filter((d): d is string => d !== null)
    )
  );
  if (cleaned.length === 0) {
    return NextResponse.json({ added: 0 });
  }

  const CHUNK = 500;
  for (let i = 0; i < cleaned.length; i += CHUNK) {
    const chunk = cleaned.slice(i, i + CHUNK).map((did) => ({
      acidListId: activeId,
      did,
    }));
    await db
      .insert(acidListDids)
      .values(chunk)
      .onConflictDoNothing({
        target: [acidListDids.acidListId, acidListDids.did],
      });
  }

  return NextResponse.json({ added: cleaned.length });
}
