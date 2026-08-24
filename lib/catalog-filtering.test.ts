import { describe, expect, it } from "vitest";

import type { CameraFilters } from "@/lib/services/equipment";
import { CAMERAS, LENSES } from "@/test/mocks/equipment";

import {
  cameraMatchesFilters,
  countByFacet,
  lensMatchesFilters,
} from "./catalog-filtering";

// CAMERAS: Sony A7 IV (full-frame, sony-e, 33MP, 658g)
//          Fujifilm X-T5 (aps-c, fujifilm-x, 40.2MP, 557g)
//          OM System OM-1 (micro-four-thirds, micro-four-thirds, 20.4MP, 599g)

describe("cameraMatchesFilters", () => {
  it("matches everything for an empty filter set", () => {
    expect(CAMERAS.every((c) => cameraMatchesFilters(c, {}))).toBe(true);
  });

  it("filters by brand", () => {
    const matches = CAMERAS.filter((c) =>
      cameraMatchesFilters(c, { brands: ["Sony"] }),
    );
    expect(matches.map((c) => c.slug)).toEqual(["sony-a7-iv"]);
  });

  it("filters by sensor format", () => {
    const matches = CAMERAS.filter((c) =>
      cameraMatchesFilters(c, { sensorFormats: ["aps-c"] }),
    );
    expect(matches.map((c) => c.slug)).toEqual(["fujifilm-x-t5"]);
  });

  it("filters by minimum resolution, inclusive", () => {
    const matches = CAMERAS.filter((c) =>
      cameraMatchesFilters(c, { minResolutionMp: 33 }),
    );
    expect(matches.map((c) => c.slug).sort()).toEqual([
      "fujifilm-x-t5",
      "sony-a7-iv",
    ]);
  });

  it("filters by maximum weight, inclusive", () => {
    const matches = CAMERAS.filter((c) =>
      cameraMatchesFilters(c, { maxWeightG: 599 }),
    );
    expect(matches.map((c) => c.slug).sort()).toEqual([
      "fujifilm-x-t5",
      "om-system-om-1",
    ]);
  });

  it("excludes a camera with a null weight from a maxWeightG filter", () => {
    const camera = { ...CAMERAS[0]!, weightG: null };
    expect(cameraMatchesFilters(camera, { maxWeightG: 10000 })).toBe(false);
  });

  it("combines multiple filters with AND", () => {
    expect(
      cameraMatchesFilters(CAMERAS[0]!, {
        brands: ["Sony"],
        sensorFormats: ["full-frame"],
        minResolutionMp: 30,
      }),
    ).toBe(true);
    expect(
      cameraMatchesFilters(CAMERAS[0]!, {
        brands: ["Sony"],
        sensorFormats: ["aps-c"],
      }),
    ).toBe(false);
  });
});

// LENSES: Sony FE 50mm F1.8 (sony-e, 50-50mm, f1.8, 186g, prime)
//         Fujifilm XF 16-55mm F2.8 (fujifilm-x, 16-55mm, f2.8, 655g, zoom)
//         Olympus M.Zuiko 25mm F1.8 (micro-four-thirds, 25-25mm, f1.8, 137g, prime)

describe("lensMatchesFilters", () => {
  it("matches everything for an empty filter set", () => {
    expect(LENSES.every((l) => lensMatchesFilters(l, {}))).toBe(true);
  });

  it("filters primes vs zooms", () => {
    expect(
      LENSES.filter((l) => lensMatchesFilters(l, { focalType: "prime" })).map(
        (l) => l.slug,
      ),
    ).toEqual(["sony-fe-50mm-f1-8", "olympus-mzuiko-25mm-f1-8"]);
    expect(
      LENSES.filter((l) => lensMatchesFilters(l, { focalType: "zoom" })).map(
        (l) => l.slug,
      ),
    ).toEqual(["fujifilm-xf-16-55mm-f2-8"]);
  });

  it("matches focal length as a range overlap", () => {
    // A 16-55mm zoom's range overlaps a requested 50-70mm window even
    // though it doesn't reach 70mm itself.
    const matches = LENSES.filter((l) =>
      lensMatchesFilters(l, { minFocalLength: 50, maxFocalLength: 70 }),
    );
    expect(matches.map((l) => l.slug).sort()).toEqual([
      "fujifilm-xf-16-55mm-f2-8",
      "sony-fe-50mm-f1-8",
    ]);
  });

  it("filters by maximum aperture (f-number), inclusive", () => {
    const matches = LENSES.filter((l) =>
      lensMatchesFilters(l, { maxAperture: 1.8 }),
    );
    expect(matches.map((l) => l.slug).sort()).toEqual([
      "olympus-mzuiko-25mm-f1-8",
      "sony-fe-50mm-f1-8",
    ]);
  });
});

describe("countByFacet", () => {
  it("counts items per value, ignoring the excluded facet's own filter", () => {
    // Even filtered to Sony only, excluding "brands" from the count still
    // shows what every brand's count would be under the other active
    // filters (none, here) — the standard faceted-search semantic.
    const filters: CameraFilters = { brands: ["Sony"] };
    const counts = countByFacet(
      CAMERAS,
      filters,
      "brands",
      cameraMatchesFilters,
      (c) => c.brand,
    );
    expect(counts.get("Sony")).toBe(1);
    expect(counts.get("Fujifilm")).toBe(1);
    expect(counts.get("OM System")).toBe(1);
  });

  it("still applies every other active filter when counting", () => {
    // Filtered to full-frame; counting brands should only see the Sony
    // camera (the only full-frame body), not the aps-c/m4/3 ones.
    const filters: CameraFilters = { sensorFormats: ["full-frame"] };
    const counts = countByFacet(
      CAMERAS,
      filters,
      "brands",
      cameraMatchesFilters,
      (c) => c.brand,
    );
    expect(counts.get("Sony")).toBe(1);
    expect(counts.has("Fujifilm")).toBe(false);
  });

  it("returns an empty map when nothing matches", () => {
    const filters: CameraFilters = { minResolutionMp: 1000 };
    const counts = countByFacet(
      CAMERAS,
      filters,
      "brands",
      cameraMatchesFilters,
      (c) => c.brand,
    );
    expect(counts.size).toBe(0);
  });
});
