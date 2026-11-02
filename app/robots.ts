import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-config";

// AI training/answer crawlers. They walk every compare/filter URL
// combination and each hit is a dynamic render, so they are blocked
// outright rather than just kept off the query-string variants below.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "FacebookBot",
  "cohere-ai",
  "Diffbot",
  "Omgilibot",
  "ImagesiftBot",
  "Timpibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: AI_CRAWLERS,
        disallow: "/",
      },
      // /compare and the catalog listings accept arbitrary query strings
      // (compared slugs, filters, sort), so every combination is a distinct
      // per-request render. The bare pages stay crawlable, and every
      // camera/lens page is listed in the sitemap, so nothing reachable
      // only through a query string is lost. opengraph-image routes stay
      // crawlable so link previews keep working.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/*/compare?", "/*/cameras?", "/*/lenses?"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
