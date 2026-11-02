"use client";

import { useEffect, useState } from "react";

import { parseCatalogResponse, type CatalogItem } from "@/lib/search";

export const SEARCH_CATALOG_URL = "/api/catalog";

/**
 * Loads the compare selector's search index from the static /api/catalog
 * route the first time `enabled` is true, then keeps it for the component's
 * lifetime so every keystroke searches locally. After a failed load, the
 * next time `enabled` turns true (e.g. reopening the popover) retries.
 */
export function useSearchCatalog(enabled: boolean): {
  catalog: CatalogItem[] | undefined;
  hasError: boolean;
} {
  const [catalog, setCatalog] = useState<CatalogItem[]>();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!enabled || catalog) {
      return;
    }

    const controller = new AbortController();

    fetch(SEARCH_CATALOG_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: unknown) => {
        const items = parseCatalogResponse(data);
        if (!items) {
          throw new Error("unexpected catalog body");
        }
        setCatalog(items);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("[useSearchCatalog] failed to load catalog", error);
        setHasError(true);
      });

    return () => {
      controller.abort();
      // Clears a failed attempt's error when `enabled` turns false, so the
      // retry on the next enable shows as loading rather than as an error.
      setHasError(false);
    };
  }, [enabled, catalog]);

  return { catalog, hasError };
}
