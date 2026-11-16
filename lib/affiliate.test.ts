import { describe, expect, it } from "vitest";

import { buildRetailerLinks, type AffiliateConfig } from "@/lib/affiliate";

const NETWORK_TEMPLATE = "https://network.example/c/123?u={url}";

const FULL_CONFIG: AffiliateConfig = {
  amazonTags: { us: "camspecs-20", br: "camspecs0b-20" },
  bhLinkTemplate: NETWORK_TEMPLATE,
  mpbLinkTemplate: NETWORK_TEMPLATE,
};

describe("buildRetailerLinks", () => {
  it("returns no links when nothing is configured", () => {
    expect(
      buildRetailerLinks("Sony Alpha 7 IV", "en", { amazonTags: {} }),
    ).toEqual([]);
  });

  it("links to the Amazon store serving the locale's readers, with its tag", () => {
    const cases = [
      ["en", "www.amazon.com", "camspecs-20"],
      ["es", "www.amazon.com", "camspecs-20"],
      ["pt-BR", "www.amazon.com.br", "camspecs0b-20"],
    ] as const;

    for (const [locale, host, tag] of cases) {
      const amazon = buildRetailerLinks(
        "Sony Alpha 7 IV",
        locale,
        FULL_CONFIG,
      ).find((link) => link.retailerId === "amazon");
      const url = new URL(amazon?.href ?? "");
      expect(url.host).toBe(host);
      expect(url.searchParams.get("k")).toBe("Sony Alpha 7 IV");
      expect(url.searchParams.get("tag")).toBe(tag);
    }
  });

  it("omits Amazon when the locale's marketplace has no tag", () => {
    const links = buildRetailerLinks("Nikon Zf", "pt-BR", {
      amazonTags: { us: "camspecs-20" },
    });
    expect(links).toEqual([]);
  });

  it("wraps the retailer search URL in the network deep-link template", () => {
    const bh = buildRetailerLinks("Nikon Zf", "en", FULL_CONFIG).find(
      (link) => link.retailerId === "bh",
    );
    const url = new URL(bh?.href ?? "");
    expect(url.origin).toBe("https://network.example");
    expect(url.searchParams.get("u")).toBe(
      "https://www.bhphotovideo.com/c/search?q=Nikon+Zf",
    );
  });

  it("ignores a template without the {url} placeholder or not on https", () => {
    const links = buildRetailerLinks("Nikon Zf", "en", {
      amazonTags: {},
      bhLinkTemplate: "https://network.example/c/123",
      mpbLinkTemplate: "javascript:alert({url})",
    });
    expect(links).toEqual([]);
  });

  it.each([
    ["en", ["amazon", "bh", "mpb"]],
    ["es", ["amazon", "bh"]],
    ["pt-BR", ["amazon"]],
  ])("shows %s readers only the stores that serve them", (locale, expected) => {
    const ids = buildRetailerLinks("Nikon Zf", locale, FULL_CONFIG).map(
      (link) => link.retailerId,
    );
    expect(ids).toEqual(expected);
  });

  it("returns no links for a locale with no market", () => {
    expect(buildRetailerLinks("Nikon Zf", "fr", FULL_CONFIG)).toEqual([]);
  });
});
