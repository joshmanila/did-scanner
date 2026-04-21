import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { dialers } from "@/db/schema";
import { encryptToken } from "@/lib/crypto";

interface CreateDialerBody {
  name?: string;
  apiUrl?: string;
  authToken?: string;
}

export async function POST(request: Request) {
  let body: CreateDialerBody;
  try {
    body = (await request.json()) as CreateDialerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = body.name?.trim();
  const apiUrl = body.apiUrl?.trim();
  const authToken = body.authToken?.trim();
  if (!name || !apiUrl || !authToken) {
    return NextResponse.json(
      { error: "name, apiUrl, and authToken are required" },
      { status: 400 }
    );
  }

  let encrypted: string;
  try {
    encrypted = encryptToken(authToken);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Encryption failed. Ensure APP_ENCRYPTION_KEY is set.",
      },
      { status: 500 }
    );
  }

  try {
    const db = getDb();
    const rows = await db
      .insert(dialers)
      .values({
        name,
        convosoApiUrl: apiUrl,
        convosoAuthTokenEncrypted: encrypted,
      })
      .returning();
    return NextResponse.json({ dialer: rows[0] });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create dialer (duplicate name?)",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(dialers).orderBy(dialers.name);
  const sanitized = rows.map((d) => ({
    id: d.id,
    name: d.name,
    convosoApiUrl: d.convosoApiUrl,
    isActive: d.isActive,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
  return NextResponse.json({ dialers: sanitized });
}
