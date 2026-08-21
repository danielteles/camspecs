import { describe, expect, it } from "vitest";

import { CAMERAS, LENSES } from "./mock-data";
import { resolveCatalogSlugs, searchCatalog } from "./search";

const TOTAL_ITEMS = CAMERAS.length + LENSES.length;

describe("searchCatalog", () => {
  it("returns the full catalog for an empty query", () => {
    expect(searchCatalog("")).toHaveLength(TOTAL_ITEMS);
  });

  it("returns the full catalog for a whitespace-only query", () => {
    expect(searchCatalog("   ")).toHaveLength(TOTAL_ITEMS);
  });

  it("matches by brand, case-insensitively", () => {
    const results = searchCatalog("SONY");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.brand === "Sony")).toBe(true);
  });

  it("matches by model substring", () => {
    const results = searchCatalog("x-t5");
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("fujifilm-x-t5");
  });

  it("matches across brand and model combined", () => {
    const results = searchCatalog("fujifilm x-t5");
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("fujifilm-x-t5");
  });

  it("returns both cameras and lenses for a mount query", () => {
    const results = searchCatalog("sony");
    const types = new Set(results.map((item) => item.type));
    expect(types.has("camera")).toBe(true);
    expect(types.has("lens")).toBe(true);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchCatalog("nonexistent-camera-xyz")).toEqual([]);
  });
});

describe("resolveCatalogSlugs", () => {
  it("resolves known slugs to their catalog items", () => {
    const results = resolveCatalogSlugs(["sony-a7-iv", "fujifilm-x-t5"]);
    expect(results.map((item) => item.slug)).toEqual([
      "sony-a7-iv",
      "fujifilm-x-t5",
    ]);
  });

  it("preserves the requested order, independent of catalog order", () => {
    const results = resolveCatalogSlugs(["fujifilm-x-t5", "sony-a7-iv"]);
    expect(results.map((item) => item.slug)).toEqual([
      "fujifilm-x-t5",
      "sony-a7-iv",
    ]);
  });

  it("silently drops unknown slugs", () => {
    const results = resolveCatalogSlugs(["sony-a7-iv", "does-not-exist"]);
    expect(results.map((item) => item.slug)).toEqual(["sony-a7-iv"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(resolveCatalogSlugs([])).toEqual([]);
  });
});
