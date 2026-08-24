import { describe, expect, it } from "vitest";

import {
  parseCameraFilters,
  parseLensFilters,
  searchParamsFromRecord,
  serializeCameraFilters,
  serializeLensFilters,
} from "./catalog-params";

describe("parseCameraFilters", () => {
  it("returns an empty object for no params", () => {
    expect(parseCameraFilters(new URLSearchParams())).toEqual({});
  });

  it("parses a comma-separated brand list", () => {
    expect(
      parseCameraFilters(new URLSearchParams("brand=Sony,Fujifilm")),
    ).toEqual({ brands: ["Sony", "Fujifilm"] });
  });

  it("deduplicates and trims list entries", () => {
    expect(
      parseCameraFilters(new URLSearchParams("brand=Sony, Sony ,Fujifilm")),
    ).toEqual({ brands: ["Sony", "Fujifilm"] });
  });

  it("parses sensor formats and mounts", () => {
    expect(
      parseCameraFilters(
        new URLSearchParams("sensor=full-frame,aps-c&mount=sony-e"),
      ),
    ).toEqual({
      sensorFormats: ["full-frame", "aps-c"],
      mounts: ["sony-e"],
    });
  });

  it("parses min_megapixels and max_weight as numbers", () => {
    expect(
      parseCameraFilters(
        new URLSearchParams("min_megapixels=24&max_weight=700"),
      ),
    ).toEqual({ minResolutionMp: 24, maxWeightG: 700 });
  });

  it("ignores a non-numeric min_megapixels", () => {
    expect(
      parseCameraFilters(new URLSearchParams("min_megapixels=not-a-number")),
    ).toEqual({});
  });

  it("round-trips through serializeCameraFilters", () => {
    const filters = {
      brands: ["Sony", "Fujifilm"],
      sensorFormats: ["full-frame" as const],
      mounts: ["sony-e" as const],
      minResolutionMp: 24,
      maxWeightG: 700,
    };
    const roundTripped = parseCameraFilters(
      new URLSearchParams(serializeCameraFilters(filters)),
    );
    expect(roundTripped).toEqual(filters);
  });
});

describe("serializeCameraFilters", () => {
  it("omits keys for unset filters entirely", () => {
    expect(serializeCameraFilters({})).toEqual({});
  });

  it("joins array filters with commas", () => {
    expect(serializeCameraFilters({ brands: ["Sony", "Fujifilm"] })).toEqual({
      brand: "Sony,Fujifilm",
    });
  });

  it("stringifies numeric filters", () => {
    expect(serializeCameraFilters({ minResolutionMp: 24 })).toEqual({
      min_megapixels: "24",
    });
  });
});

describe("parseLensFilters", () => {
  it("returns an empty object for no params", () => {
    expect(parseLensFilters(new URLSearchParams())).toEqual({});
  });

  it("parses focal_type only when it's a known value", () => {
    expect(parseLensFilters(new URLSearchParams("focal_type=prime"))).toEqual({
      focalType: "prime",
    });
    expect(parseLensFilters(new URLSearchParams("focal_type=bogus"))).toEqual(
      {},
    );
  });

  it("parses min_focal, max_focal, and max_aperture as numbers", () => {
    expect(
      parseLensFilters(
        new URLSearchParams("min_focal=24&max_focal=70&max_aperture=2.8"),
      ),
    ).toEqual({ minFocalLength: 24, maxFocalLength: 70, maxAperture: 2.8 });
  });

  it("round-trips through serializeLensFilters", () => {
    const filters = {
      brands: ["Sony"],
      mounts: ["sony-e" as const],
      focalType: "zoom" as const,
      minFocalLength: 24,
      maxFocalLength: 70,
      maxAperture: 2.8,
    };
    const roundTripped = parseLensFilters(
      new URLSearchParams(serializeLensFilters(filters)),
    );
    expect(roundTripped).toEqual(filters);
  });
});

describe("searchParamsFromRecord", () => {
  it("converts a plain string record", () => {
    const params = searchParamsFromRecord({ brand: "Sony", mount: "sony-e" });
    expect(params.get("brand")).toBe("Sony");
    expect(params.get("mount")).toBe("sony-e");
  });

  it("drops undefined values", () => {
    const params = searchParamsFromRecord({ brand: undefined });
    expect(params.has("brand")).toBe(false);
  });

  it("appends every entry of an array value under the same key", () => {
    const params = searchParamsFromRecord({ brand: ["Sony", "Fujifilm"] });
    expect(params.getAll("brand")).toEqual(["Sony", "Fujifilm"]);
  });
});
