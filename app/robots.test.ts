import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import { SITE_URL } from "@/lib/site-config";

const [aiRule, defaultRule] = [robots().rules].flat();

// Mirrors Google's robots.txt matching: `*` matches any run of characters,
// and a rule matches any URL path that starts with it.
function isDisallowed(path: string): boolean {
  return [defaultRule?.disallow ?? []].flat().some((rule) => {
    const pattern = rule
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${pattern}`).test(path);
  });
}

describe("robots", () => {
  it("blocks AI training crawlers from the whole site", () => {
    expect(aiRule?.userAgent).toEqual(
      expect.arrayContaining(["GPTBot", "ClaudeBot", "CCBot"]),
    );
    expect(aiRule?.disallow).toBe("/");
  });

  it("leaves per-request AI fetchers and AI search indexes to the default rules", () => {
    for (const agent of [
      "ChatGPT-User",
      "Claude-User",
      "Perplexity-User",
      "OAI-SearchBot",
      "Claude-SearchBot",
    ]) {
      expect(aiRule?.userAgent).not.toContain(agent);
    }
    expect(defaultRule?.userAgent).toBe("*");
  });

  it.each([
    "/api/search?q=sony",
    "/en/compare?items=sony-a7-iv,fujifilm-x-t5",
    "/pt-BR/cameras?mounts=sony-e",
    "/es/lenses?focalType=prime",
  ])("disallows %s", (path) => {
    expect(isDisallowed(path)).toBe(true);
  });

  it.each([
    "/en",
    "/en/compare",
    "/en/cameras",
    "/en/cameras/sony-a7-iv",
    "/en/cameras/sony-a7-iv/opengraph-image",
    "/es/lenses",
    "/es/lenses/sony-fe-50mm-f1-8",
  ])("allows %s", (path) => {
    expect(isDisallowed(path)).toBe(false);
  });

  it("points crawlers to the sitemap", () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
