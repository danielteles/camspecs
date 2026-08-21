import { describe, expect, it } from "vitest";

import {
  MAX_COMPARE_ITEMS,
  parseCompareItems,
  serializeCompareItems,
} from "./compare-params";

describe("parseCompareItems", () => {
  it("returns an empty array for null, undefined, or empty input", () => {
    expect(parseCompareItems(null)).toEqual([]);
    expect(parseCompareItems(undefined)).toEqual([]);
    expect(parseCompareItems("")).toEqual([]);
  });

  it("splits a comma-separated list of slugs", () => {
    expect(parseCompareItems("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace around slugs", () => {
    expect(parseCompareItems(" a , b ,c ")).toEqual(["a", "b", "c"]);
  });

  it("drops empty segments", () => {
    expect(parseCompareItems("a,,b,")).toEqual(["a", "b"]);
  });

  it("deduplicates repeated slugs, keeping the first occurrence", () => {
    expect(parseCompareItems("a,b,a,c,b")).toEqual(["a", "b", "c"]);
  });

  it(`caps the result at ${MAX_COMPARE_ITEMS} items`, () => {
    const slugs = ["a", "b", "c", "d", "e", "f"];
    const result = parseCompareItems(slugs.join(","));
    expect(result).toHaveLength(MAX_COMPARE_ITEMS);
    expect(result).toEqual(slugs.slice(0, MAX_COMPARE_ITEMS));
  });
});

describe("serializeCompareItems", () => {
  it("joins slugs with commas", () => {
    expect(serializeCompareItems(["a", "b", "c"])).toBe("a,b,c");
  });

  it("returns an empty string for an empty array", () => {
    expect(serializeCompareItems([])).toBe("");
  });
});
