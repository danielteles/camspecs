import { describe, expect, it } from "vitest";

import { CAMERAS, LENSES } from "@/test/mocks/equipment";

import { buildCatalog, parseCatalogResponse, searchCatalog } from "./search";

const CATALOG = buildCatalog(CAMERAS, LENSES);
const TOTAL_ITEMS = CAMERAS.length + LENSES.length;

describe("searchCatalog", () => {
  it("returns the full catalog for an empty query", () => {
    expect(searchCatalog(CATALOG, "")).toHaveLength(TOTAL_ITEMS);
  });

  it("returns the full catalog for a whitespace-only query", () => {
    expect(searchCatalog(CATALOG, "   ")).toHaveLength(TOTAL_ITEMS);
  });

  it("matches by brand, case-insensitively", () => {
    const results = searchCatalog(CATALOG, "SONY");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.brand === "Sony")).toBe(true);
  });

  it("matches by model substring", () => {
    const results = searchCatalog(CATALOG, "x-t5");
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("fujifilm-x-t5");
  });

  it("matches across brand and model combined", () => {
    const results = searchCatalog(CATALOG, "fujifilm x-t5");
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("fujifilm-x-t5");
  });

  it("returns both cameras and lenses for a mount query", () => {
    const results = searchCatalog(CATALOG, "sony");
    const types = new Set(results.map((item) => item.type));
    expect(types.has("camera")).toBe(true);
    expect(types.has("lens")).toBe(true);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchCatalog(CATALOG, "nonexistent-camera-xyz")).toEqual([]);
  });
});

describe("parseCatalogResponse", () => {
  const sony = {
    type: "camera",
    slug: "sony-a7-iv",
    brand: "Sony",
    model: "Alpha 7 IV",
    mount: "sony-e",
  };

  it("returns the items of a well-formed { items } body", () => {
    expect(parseCatalogResponse({ items: [sony] })).toEqual([sony]);
  });

  it("rejects a body without an items array", () => {
    expect(parseCatalogResponse({ results: [sony] })).toBe(undefined);
    expect(parseCatalogResponse(null)).toBe(undefined);
    expect(parseCatalogResponse({ items: "nope" })).toBe(undefined);
  });

  it("drops entries that aren't catalog items", () => {
    expect(
      parseCatalogResponse({
        items: [
          sony,
          { ...sony, type: "tripod" },
          { ...sony, mount: "canon-ef" },
          42,
        ],
      }),
    ).toEqual([sony]);
  });
});
