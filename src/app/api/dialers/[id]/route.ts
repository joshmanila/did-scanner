import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dialers } from "@/db/schema";
import { encryptToken } from "@/lib/crypto";

interface UpdateDialerBody {
  name?: string;
  apiUrl?: string;
  authToken?: string;
  isActive?: boolean;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: UpdateDialerBody;
  try {
    body = (await request.json()) as UpdateDialerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.apiUrl !== undefined) update.convosoApiUrl = body.apiUrl.trim();
  if (body.isActive !== undefined) update.isActive = body.isActive;
  if (body.authToken !== undefined && body.authToken.trim() !== "") {
    try {
      update.convosoAuthTokenEncrypted = encryptToken(body.authToken.trim());
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Encryption failed.",
        },
        { status: 500 }
      );
    }
  }

  try {
    const db = getDb();
    const rows = await db
      .update(dialers)
      .set(update)
      .where(eq(dialers.id, id))
      .returning();
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Dialer not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ dialer: rows[0] });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update dialer",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const db = getDb();
    await db.delete(dialers).where(eq(dialers.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to delete dialer",
      },
      { status: 500 }
    );
  }
}
