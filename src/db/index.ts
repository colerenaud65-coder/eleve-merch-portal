import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import ws from "ws";

import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

export type Database = NodePgDatabase<typeof schema>;

let database: Database | null = null;

function isLocal(url: string) {
  return /localhost|127\.0\.0\.1/.test(url);
}

export function getDb(): Database {
  if (database) return database;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  if (isLocal(url)) {
    const pool = new PgPool({ connectionString: url });
    database = drizzlePg(pool, { schema });
    return database;
  }

  const pool = new NeonPool({ connectionString: url });
  database = drizzleNeon(pool, { schema }) as unknown as Database;
  return database;
}
