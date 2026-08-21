import { vi } from "vitest";

import { resolveCatalogSlugs, searchCatalog } from "@/lib/search";

/**
 * Installs a `global.fetch` stub for `/api/search` that delegates to the
 * real `lib/search.ts` logic against the real mock catalog. This exercises
 * the same filtering/resolution behavior as the actual API route without
 * spinning up a Next.js server, and stays correct automatically if the
 * mock catalog changes.
 */
export function installSearchFetchMock() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    const slugsParam = url.searchParams.get("slugs");

    const results =
      slugsParam !== null
        ? resolveCatalogSlugs(
            slugsParam
              .split(",")
              .map((slug) => slug.trim())
              .filter(Boolean),
          )
        : searchCatalog(url.searchParams.get("q") ?? "");

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}
