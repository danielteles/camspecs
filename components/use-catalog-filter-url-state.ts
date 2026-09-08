"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";

export interface CatalogFilterUrlState<TFilters> {
  /** Parsed from the current URL search params. */
  filters: TFilters;
  /** Serializes `next` and replaces the URL with it, inside a transition. */
  updateFilters: (next: TFilters) => void;
  /** Clears the free-text search query and every filter. */
  resetAll: () => void;
  query: string;
  setQuery: (query: string) => void;
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (open: boolean) => void;
  /** True while a filter change's URL update is still applying. */
  isPending: boolean;
}

/**
 * Shared URL-backed filter state for the cameras and lenses catalogs:
 * parsing/serializing filters through the URL, the pending transition that
 * change goes through, and the free-text search / mobile-drawer UI state
 * that sits alongside it. Each catalog still builds its own `FilterSection`
 * list and facet counts, which differ enough per domain (checkbox vs. range
 * sections, distinct filter shapes) that folding them in here would trade
 * one kind of duplication for a much less readable generic.
 */
export function useCatalogFilterUrlState<TFilters>({
  emptyFilters,
  parseFilters,
  serializeFilters,
}: {
  /** The filters value that clears every URL param (usually `{}`). */
  emptyFilters: TFilters;
  parseFilters: (params: URLSearchParams) => TFilters;
  serializeFilters: (filters: TFilters) => Record<string, string>;
}): CatalogFilterUrlState<TFilters> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = useMemo(
    () => parseFilters(searchParams),
    [searchParams, parseFilters],
  );

  function updateFilters(next: TFilters) {
    const nextQuery = serializeFilters(next);
    const href =
      Object.keys(nextQuery).length > 0
        ? { pathname, query: nextQuery }
        : { pathname };
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function resetAll() {
    setQuery("");
    updateFilters(emptyFilters);
  }

  return {
    filters,
    updateFilters,
    resetAll,
    query,
    setQuery,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    isPending,
  };
}
