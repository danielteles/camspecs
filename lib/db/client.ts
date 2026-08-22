import { Kysely, PostgresDialect } from "kysely";
import { Pool, types } from "pg";

import type { Database } from "./schema";

// node-postgres returns NUMERIC (OID 1700) columns as strings to avoid
// float precision loss; camera/lens specs don't need that precision, so
// parse them to numbers here once instead of in every query.
types.setTypeParser(1700, (value) =>
  value === null ? null : parseFloat(value),
);

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return url;
}

declare global {
  var __camspecsDbPool: Pool | undefined;
}

// Next.js dev reloads server modules on every edit; caching the pool on
// `globalThis` stops a fresh import from opening a new pool each time and
// exhausting the database's connection limit.
function getPool(): Pool {
  globalThis.__camspecsDbPool ??= new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
  });
  return globalThis.__camspecsDbPool;
}

let dbInstance: Kysely<Database> | undefined;

export function getDb(): Kysely<Database> {
  dbInstance ??= new Kysely<Database>({
    dialect: new PostgresDialect({ pool: getPool() }),
  });
  return dbInstance;
}
