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

// generateStaticParams for camera/lens routes runs at build time, before
// any request-scoped env is guaranteed — e.g. a CI build with the DB
// secret unset. Callers use this to skip static generation instead of
// hard-failing the whole build; pages still render on demand at request
// time via dynamicParams, once a real DATABASE_URL is available.
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
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
