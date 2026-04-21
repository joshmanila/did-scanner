import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { acidListDids, acidLists } from "@/db/schema";

interface CreateAcidListBody {
  dialerId?: string;
  name?: string;
  dids?: string[];
}

function cleanDid(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

export async function POST(request: Request) {
  let body: CreateAcidListBody;
  try {
    body = (await request.json()) as CreateAcidListBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dialerId = body.dialerId?.trim();
  const name = body.name?.trim();
  const rawDids = Array.isArray(body.dids) ? body.dids : [];
  if (!dialerId || !name || rawDids.length === 0) {
    return NextResponse.json(
      { error: "dialerId, name, and non-empty dids[] required" },
      { status: 400 }
    );
  }
  const cleaned: string[] = [];
  for (const r of rawDids) {
    const c = cleanDid(r);
    if (c) cleaned.push(c);
  }
  const uniqueDids = Array.from(new Set(cleaned));
  if (uniqueDids.length === 0) {
    return NextResponse.json(
      { error: "No valid 10-digit DIDs found in list." },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const listRows = await db
      .insert(acidLists)
      .values({ dialerId, name })
      .returning();
    const list = listRows[0];
    const CHUNK = 500;
    for (let i = 0; i < uniqueDids.length; i += CHUNK) {
      const chunk = uniqueDids.slice(i, i + CHUNK).map((did) => ({
        acidListId: list.id,
        did,
      }));
      await db
        .insert(acidListDids)
        .values(chunk)
        .onConflictDoNothing({ target: [acidListDids.acidListId, acidListDids.did] });
    }
    return NextResponse.json({
      list,
      didCount: uniqueDids.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to create ACID list",
      },
      { status: 500 }
    );
  }
}
