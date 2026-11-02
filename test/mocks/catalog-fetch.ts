import { vi } from "vitest";

import { buildCatalog } from "@/lib/search";
import { CAMERAS, LENSES } from "@/test/mocks/equipment";

/**
 * Installs a `global.fetch` stub for `/api/catalog` that serves the real
 * `lib/search.ts` index built from the shared equipment fixtures, the same
 * payload the actual route returns, without a Next.js server or database.
 */
export function installCatalogFetchMock() {
  const fetchMock = vi.fn(() =>
    Promise.resolve(Response.json({ items: buildCatalog(CAMERAS, LENSES) })),
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}
