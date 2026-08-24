import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";

import type { Database } from "@/lib/db/schema";

/**
 * A Kysely instance wired to Postgres's SQL compiler but a DummyDriver that
 * never opens a connection. `.compile()` only needs the compiler, so this
 * lets query-builder functions be unit-tested against the exact SQL/params
 * they produce without a live database.
 */
export function createCompileOnlyDb(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}
