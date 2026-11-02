import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Driver,
} from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/schema";
import {
  getAllCameras,
  getAllLenses,
  getCameraBySlug,
  getLensBySlug,
} from "@/lib/services/equipment";

// This module is globally mocked in vitest.setup.tsx; exercise the real one.
// `vi.unmock`/`vi.mock` are hoisted above the imports, and getDb only builds
// the fixture DB when a query runs, after the fixtures below are defined.
vi.unmock("@/lib/services/equipment");

// Stand-in for unstable_cache's persistence: a cache hit returns the stored
// value after a JSON round-trip, which turns every Date into an ISO string.
vi.mock("next/cache", () => ({
  unstable_cache:
    <Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) =>
    async (...args: Args): Promise<R> =>
      JSON.parse(JSON.stringify(await fn(...args))) as R,
}));

const UPDATED_AT = new Date("2026-08-20T12:00:00Z");

const CAMERA_ROW = {
  slug: "sony-a7-iv",
  brand: "Sony",
  model: "A7 IV",
  mount: "sony-e",
  sensor_format: "full-frame",
  sensor_width_mm: 35.9,
  sensor_height_mm: 23.9,
  megapixels: 33,
  release_year: 2021,
  weight_g: 658,
  updated_at: UPDATED_AT,
};

const LENS_ROW = {
  slug: "sony-fe-50mm-f1-8",
  brand: "Sony",
  model: "FE 50mm F1.8",
  mount: "sony-e",
  min_focal_length_mm: 50,
  max_focal_length_mm: 50,
  min_aperture: 22,
  max_aperture: 1.8,
  weight_g: 186,
  is_prime: true,
  release_year: 2016,
  updated_at: UPDATED_AT,
};

// A Kysely instance whose driver answers every query with the camera or
// lens fixture row, picked by the table the compiled SQL selects from.
function createFixtureDb(): Kysely<Database> {
  const connection: DatabaseConnection = {
    executeQuery: async (query) =>
      ({
        rows: [query.sql.includes('"cameras"') ? CAMERA_ROW : LENS_ROW],
      }) as never,
    streamQuery: () => {
      throw new Error("not supported");
    },
  };
  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    releaseConnection: async () => {},
    destroy: async () => {},
  };
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}

vi.mock("@/lib/db/client", () => ({
  getDb: () => createFixtureDb(),
}));

describe("cached equipment reads", () => {
  it("return updatedAt as a Date after the cache's JSON round-trip", async () => {
    const [cameras, lenses, camera, lens] = await Promise.all([
      getAllCameras(),
      getAllLenses(),
      getCameraBySlug(CAMERA_ROW.slug),
      getLensBySlug(LENS_ROW.slug),
    ]);

    for (const item of [cameras[0], lenses[0], camera, lens]) {
      expect(item?.updatedAt).toBeInstanceOf(Date);
      expect(item?.updatedAt).toEqual(UPDATED_AT);
    }
  });
});
