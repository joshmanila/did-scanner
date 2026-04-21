import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is required but was not set."
    );
  }
  return url;
}

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;
  const sql = neon(getDatabaseUrl());
  cachedDb = drizzle(sql, { schema });
  return cachedDb;
}

export type Database = ReturnType<typeof getDb>;

export { schema };
