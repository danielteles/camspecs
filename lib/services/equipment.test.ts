import { describe, expect, it, vi } from "vitest";

// This module is globally mocked in vitest.setup.tsx (server components use
// the mock to avoid a live DB in unrelated tests). Undo that here so this
// file exercises the real query builders — `vi.unmock` is hoisted above the
// import below, same as `vi.mock`.
vi.unmock("@/lib/services/equipment");

import { buildCamerasQuery, buildLensesQuery } from "@/lib/services/equipment";
import { createCompileOnlyDb } from "@/test/kysely-test-db";

const db = createCompileOnlyDb();

describe("buildCamerasQuery", () => {
  it("compiles with no WHERE clause and the default brand/model sort", () => {
    const { sql, parameters } = buildCamerasQuery(db).compile();
    expect(sql).not.toMatch(/where/i);
    expect(sql).toMatch(/order by "brand" asc, "model" asc$/i);
    expect(parameters).toEqual([]);
  });

  it("filters by brands using IN", () => {
    const { sql, parameters } = buildCamerasQuery(db, {
      brands: ["Sony", "Fujifilm"],
    }).compile();
    expect(sql).toMatch(/where "brand" in \(\$1, \$2\)/i);
    expect(parameters).toEqual(["Sony", "Fujifilm"]);
  });

  it("ignores an empty brands array instead of matching nothing", () => {
    const { sql, parameters } = buildCamerasQuery(db, { brands: [] }).compile();
    expect(sql).not.toMatch(/where/i);
    expect(parameters).toEqual([]);
  });

  it("filters by sensor formats and mounts", () => {
    const { sql, parameters } = buildCamerasQuery(db, {
      sensorFormats: ["full-frame", "aps-c"],
      mounts: ["sony-e"],
    }).compile();
    expect(sql).toMatch(
      /where "sensor_format" in \(\$1, \$2\) and "mount" in \(\$3\)/i,
    );
    expect(parameters).toEqual(["full-frame", "aps-c", "sony-e"]);
  });

  it("filters by minimum resolution and maximum weight", () => {
    const { sql, parameters } = buildCamerasQuery(db, {
      minResolutionMp: 24,
      maxWeightG: 700,
    }).compile();
    expect(sql).toMatch(/where "megapixels" >= \$1 and "weight_g" <= \$2/i);
    expect(parameters).toEqual([24, 700]);
  });

  it("combines every filter into a single AND-ed WHERE clause", () => {
    const { sql, parameters } = buildCamerasQuery(db, {
      brands: ["Sony"],
      sensorFormats: ["full-frame"],
      mounts: ["sony-e"],
      minResolutionMp: 24,
      maxWeightG: 700,
    }).compile();
    expect(sql).toMatch(
      /where "brand" in \(\$1\) and "sensor_format" in \(\$2\) and "mount" in \(\$3\) and "megapixels" >= \$4 and "weight_g" <= \$5/i,
    );
    expect(parameters).toEqual(["Sony", "full-frame", "sony-e", 24, 700]);
  });

  it("sorts by the requested key, descending, with brand/model as tie-breakers", () => {
    const { sql } = buildCamerasQuery(
      db,
      {},
      {
        key: "resolution",
        direction: "desc",
      },
    ).compile();
    expect(sql).toMatch(
      /order by "megapixels" desc, "brand" asc, "model" asc$/i,
    );
  });

  it("does not duplicate brand in the ORDER BY when sorting by brand", () => {
    const { sql } = buildCamerasQuery(db, {}, { key: "brand" }).compile();
    const brandOccurrences = sql.match(/"brand"/g) ?? [];
    expect(brandOccurrences).toHaveLength(1);
  });
});

describe("buildLensesQuery", () => {
  it("compiles with no WHERE clause and the default brand/model sort", () => {
    const { sql, parameters } = buildLensesQuery(db).compile();
    expect(sql).not.toMatch(/where/i);
    expect(sql).toMatch(/order by "brand" asc, "model" asc$/i);
    expect(parameters).toEqual([]);
  });

  it('filters primes via is_prime = true for focalType "prime"', () => {
    const { sql, parameters } = buildLensesQuery(db, {
      focalType: "prime",
    }).compile();
    expect(sql).toMatch(/where "is_prime" = \$1/i);
    expect(parameters).toEqual([true]);
  });

  it('filters zooms via is_prime = false for focalType "zoom"', () => {
    const { parameters } = buildLensesQuery(db, {
      focalType: "zoom",
    }).compile();
    expect(parameters).toEqual([false]);
  });

  it("matches focal length as a range overlap, not an exact bound", () => {
    const { sql, parameters } = buildLensesQuery(db, {
      minFocalLength: 24,
      maxFocalLength: 70,
    }).compile();
    expect(sql).toMatch(
      /where "max_focal_length_mm" >= \$1 and "min_focal_length_mm" <= \$2/i,
    );
    expect(parameters).toEqual([24, 70]);
  });

  it("filters by maximum aperture (f-number) as an inclusive upper bound", () => {
    const { sql, parameters } = buildLensesQuery(db, {
      maxAperture: 2.8,
    }).compile();
    expect(sql).toMatch(/where "max_aperture" <= \$1/i);
    expect(parameters).toEqual([2.8]);
  });

  it("filters by brands and mounts using IN", () => {
    const { sql, parameters } = buildLensesQuery(db, {
      brands: ["Sony"],
      mounts: ["sony-e", "l-mount"],
    }).compile();
    expect(sql).toMatch(
      /where "brand" in \(\$1\) and "mount" in \(\$2, \$3\)/i,
    );
    expect(parameters).toEqual(["Sony", "sony-e", "l-mount"]);
  });

  it("sorts by aperture ascending (fastest first), with brand/model as tie-breakers", () => {
    const { sql } = buildLensesQuery(db, {}, { key: "aperture" }).compile();
    expect(sql).toMatch(
      /order by "max_aperture" asc, "brand" asc, "model" asc$/i,
    );
  });
});
