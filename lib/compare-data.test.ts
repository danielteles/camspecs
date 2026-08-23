import { describe, expect, it } from "vitest";

import { CAMERAS, LENSES } from "@/test/mocks/equipment";

import {
  buildComparisonRows,
  getI18nKey,
  resolveComparisonItems,
} from "./compare-data";

function resolve(slugs: string[]) {
  return resolveComparisonItems(slugs, CAMERAS, LENSES);
}

function getRow(rows: ReturnType<typeof buildComparisonRows>, id: string) {
  const row = rows.find((r) => r.id === id);
  if (!row) {
    throw new Error(`Missing row: ${id}`);
  }
  return row;
}

describe("resolveComparisonItems", () => {
  it("resolves camera and lens slugs, tagging each with its type", () => {
    const items = resolve(["sony-a7-iv", "sony-fe-50mm-f1-8"]);
    expect(items.map((item) => item.type)).toEqual(["camera", "lens"]);
    expect(items.map((item) => item.slug)).toEqual([
      "sony-a7-iv",
      "sony-fe-50mm-f1-8",
    ]);
  });

  it("preserves requested order and drops unknown slugs", () => {
    const items = resolve(["fujifilm-x-t5", "does-not-exist", "sony-a7-iv"]);
    expect(items.map((item) => item.slug)).toEqual([
      "fujifilm-x-t5",
      "sony-a7-iv",
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(resolve([])).toEqual([]);
  });
});

describe("getI18nKey", () => {
  it("extracts the key from an i18n-marked value", () => {
    expect(getI18nKey("i18n:ComparePage.rows.type")).toBe(
      "ComparePage.rows.type",
    );
  });

  it("returns undefined for plain display text", () => {
    expect(getI18nKey("Sony")).toBeUndefined();
  });
});

describe("buildComparisonRows", () => {
  it("includes the release year for both cameras and lenses", () => {
    const items = resolve(["sony-a7-iv", "sony-fe-50mm-f1-8"]);
    const rows = buildComparisonRows(items, CAMERAS);

    expect(getRow(rows, "releaseYear").values).toEqual(["2021", "2019"]);
  });

  it("computes the 35mm-equivalent focal length and aperture for a prime lens", () => {
    const items = resolve(["sony-a7-iv", "sony-fe-50mm-f1-8"]);
    const rows = buildComparisonRows(items, CAMERAS);

    // Sony A7 IV's real sensor (35.6x23.8mm) is close to, but not exactly,
    // 36x24mm, so its crop factor is close to but not exactly 1.00.
    expect(getRow(rows, "cropFactor").values).toEqual(["1.01×", "1.01×"]);
    expect(getRow(rows, "equivalentFocalLength").values).toEqual([
      null,
      "51mm",
    ]);
    expect(getRow(rows, "equivalentAperture").values).toEqual([null, "ƒ/1.8"]);
  });

  it("computes a focal length and equivalent range for a zoom lens", () => {
    const items = resolve(["fujifilm-x-t5", "fujifilm-xf-16-55mm-f2-8"]);
    const rows = buildComparisonRows(items, CAMERAS);

    expect(getRow(rows, "cropFactor").values).toEqual(["1.53×", "1.53×"]);
    expect(getRow(rows, "focalLength").values).toEqual([null, "16–55mm"]);
    expect(getRow(rows, "equivalentFocalLength").values).toEqual([
      null,
      "25–84mm",
    ]);
    expect(getRow(rows, "equivalentAperture").values).toEqual([null, "ƒ/4.3"]);
    expect(getRow(rows, "diagonalFieldOfView").values).toEqual([
      null,
      "28.8–82.8°",
    ]);
  });

  it("marks rows identical when every item shares the same value", () => {
    const items = resolve(["sony-a7-iv", "fujifilm-x-t5"]);
    const rows = buildComparisonRows(items, CAMERAS);

    // Both are cameras, so the "type" row is identical...
    expect(getRow(rows, "type").isIdentical).toBe(true);
    // ...but they have different sensor formats and crop factors.
    expect(getRow(rows, "sensorFormat").isIdentical).toBe(false);
    expect(getRow(rows, "cropFactor").isIdentical).toBe(false);
  });

  it("marks a row identical when it's inapplicable to every item", () => {
    // Two cameras: lens-only rows are `null` for both, which counts as
    // identical (there's nothing to differentiate, so diff mode hides it).
    const items = resolve(["sony-a7-iv", "fujifilm-x-t5"]);
    const rows = buildComparisonRows(items, CAMERAS);

    expect(getRow(rows, "focalLength").values).toEqual([null, null]);
    expect(getRow(rows, "focalLength").isIdentical).toBe(true);
  });

  it("marks every row identical for a single item", () => {
    const items = resolve(["sony-a7-iv"]);
    const rows = buildComparisonRows(items, CAMERAS);

    expect(rows.every((row) => row.isIdentical)).toBe(true);
  });

  it("returns an empty row set for an empty item list", () => {
    const rows = buildComparisonRows([]);
    expect(rows.every((row) => row.values.length === 0)).toBe(true);
    expect(rows.every((row) => row.isIdentical)).toBe(true);
  });
});
