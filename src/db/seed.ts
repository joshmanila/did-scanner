import { getDb } from "./client";
import { dialers } from "./schema";
import { encryptToken } from "../lib/crypto";

async function main() {
  const db = getDb();
  const existing = await db.select().from(dialers).limit(1);
  if (existing.length > 0) {
    console.log("dialers table already has rows; seed is a no-op.");
    return;
  }

  const apiUrl = process.env.CONVOSO_API_URL;
  const authToken = process.env.CONVOSO_AUTH_TOKEN;
  if (!apiUrl || !authToken) {
    console.log(
      "CONVOSO_API_URL and CONVOSO_AUTH_TOKEN not both set; nothing to seed."
    );
    return;
  }

  const encrypted = encryptToken(authToken);
  await db
    .insert(dialers)
    .values({
      name: "Default",
      convosoApiUrl: apiUrl,
      convosoAuthTokenEncrypted: encrypted,
    });
  console.log("Inserted Default dialer from CONVOSO_* env vars.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
