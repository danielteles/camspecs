import { vi } from "vitest";

import { buildCatalog, resolveCatalogSlugs, searchCatalog } from "@/lib/search";
import { CAMERAS, LENSES } from "@/test/mocks/equipment";

/**
 * Installs a `global.fetch` stub for `/api/search` that delegates to the
 * real `lib/search.ts` logic against the shared equipment fixtures. This
 * exercises the same filtering/resolution behavior as the actual API route
 * without spinning up a Next.js server or a real database.
 */
export function installSearchFetchMock() {
  const catalog = buildCatalog(CAMERAS, LENSES);

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    const slugsParam = url.searchParams.get("slugs");

    const results =
      slugsParam !== null
        ? resolveCatalogSlugs(
            catalog,
            slugsParam
              .split(",")
              .map((slug) => slug.trim())
              .filter(Boolean),
          )
        : searchCatalog(catalog, url.searchParams.get("q") ?? "");

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}
