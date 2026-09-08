"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  ActiveFilterBadges,
  type ActiveFilterChip,
} from "@/components/active-filter-badges";
import { CatalogItemCard } from "@/components/catalog-item-card";
import { FilterSidebar, type FilterSection } from "@/components/filter-sidebar";
import { MobileFilterDrawer } from "@/components/mobile-filter-drawer";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useCatalogFilterUrlState } from "@/components/use-catalog-filter-url-state";
import { parseLensFilters, serializeLensFilters } from "@/lib/catalog-params";
import {
  bounds,
  countByFacet,
  lensMatchesFilters,
} from "@/lib/catalog-filtering";
import { formatAperture, formatFocalLengthRange } from "@/lib/compare-data";
import { MOUNTS } from "@/lib/mounts";
import type { LensFilters } from "@/lib/services/equipment";
import type { Lens, MountId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LensesCatalogProps {
  /** Already filtered server-side (real SQL WHERE) by the current URL params. */
  lenses: Lens[];
  /** The full, unfiltered catalog — used only to enumerate facet options and counts. */
  allLenses: Lens[];
}

const EMPTY_LENS_FILTERS: LensFilters = {};

export function LensesCatalog({ lenses, allLenses }: LensesCatalogProps) {
  const tCatalog = useTranslations("Catalog");
  const tLenses = useTranslations("Catalog.lenses");
  const tFilters = useTranslations("Filters");

  const {
    filters,
    updateFilters,
    resetAll,
    query,
    setQuery,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    isPending,
  } = useCatalogFilterUrlState<LensFilters>({
    emptyFilters: EMPTY_LENS_FILTERS,
    parseFilters: parseLensFilters,
    serializeFilters: serializeLensFilters,
  });

  const focalLengthBounds = useMemo(
    () =>
      bounds(
        allLenses.flatMap((l) => [l.minFocalLengthMm, l.maxFocalLengthMm]),
        [8, 800],
      ),
    [allLenses],
  );
  const apertureBounds = useMemo(
    () =>
      bounds(
        allLenses.map((l) => l.maxAperture),
        [1, 32],
      ),
    [allLenses],
  );

  const sections: FilterSection[] = useMemo(() => {
    const brandCounts = countByFacet(
      allLenses,
      filters,
      "brands",
      lensMatchesFilters,
      (l) => l.brand,
    );
    const brandOptions = Array.from(new Set(allLenses.map((l) => l.brand)))
      .sort()
      .map((brand) => ({
        value: brand,
        label: brand,
        count: brandCounts.get(brand) ?? 0,
      }));

    const mountCounts = countByFacet(
      allLenses,
      filters,
      "mounts",
      lensMatchesFilters,
      (l) => l.mount,
    );
    const mountOptions = Array.from(new Set(allLenses.map((l) => l.mount))).map(
      (mount) => ({
        value: mount,
        label: MOUNTS[mount].name,
        count: mountCounts.get(mount) ?? 0,
      }),
    );

    const focalTypeCounts = countByFacet(
      allLenses,
      filters,
      "focalType",
      lensMatchesFilters,
      (l) => (l.isPrime ? "prime" : "zoom"),
    );
    const focalTypeOptions = [
      {
        value: "prime",
        label: tLenses("primeLabel"),
        count: focalTypeCounts.get("prime") ?? 0,
      },
      {
        value: "zoom",
        label: tLenses("zoomLabel"),
        count: focalTypeCounts.get("zoom") ?? 0,
      },
    ];

    return [
      {
        type: "checkbox",
        id: "brand",
        label: tLenses("brandFilterLabel"),
        options: brandOptions,
        selected: filters.brands ?? [],
        onChange: (selected) => updateFilters({ ...filters, brands: selected }),
      },
      {
        type: "checkbox",
        id: "mount",
        label: tLenses("mountFilterLabel"),
        options: mountOptions,
        selected: filters.mounts ?? [],
        onChange: (selected) =>
          updateFilters({ ...filters, mounts: selected as MountId[] }),
      },
      {
        type: "checkbox",
        id: "focal-type",
        label: tLenses("focalTypeFilterLabel"),
        options: focalTypeOptions,
        selected: filters.focalType ? [filters.focalType] : [],
        onChange: (selected) =>
          updateFilters({
            ...filters,
            focalType:
              selected.length === 1
                ? (selected[0] as "prime" | "zoom")
                : undefined,
          }),
      },
      {
        type: "range",
        id: "focal-length",
        label: tLenses("focalLengthFilterLabel"),
        min: focalLengthBounds[0],
        max: focalLengthBounds[1],
        step: 1,
        value: [
          filters.minFocalLength ?? focalLengthBounds[0],
          filters.maxFocalLength ?? focalLengthBounds[1],
        ],
        onChange: ([min, max]) =>
          updateFilters({
            ...filters,
            minFocalLength: min === focalLengthBounds[0] ? undefined : min,
            maxFocalLength: max === focalLengthBounds[1] ? undefined : max,
          }),
        formatValue: (value) => `${value}mm`,
        thumbLabels: [
          tLenses("minFocalLengthThumbLabel"),
          tLenses("maxFocalLengthThumbLabel"),
        ],
      },
      {
        type: "range",
        id: "aperture",
        label: tLenses("maxApertureFilterLabel"),
        min: apertureBounds[0],
        max: apertureBounds[1],
        step: 0.1,
        value: [filters.maxAperture ?? apertureBounds[1]],
        onChange: ([value]) =>
          updateFilters({
            ...filters,
            maxAperture: value === apertureBounds[1] ? undefined : value,
          }),
        formatValue: (value) => formatAperture(value),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateFilters closes over filters/pathname/router, which are already covered by their own deps
  }, [allLenses, filters, focalLengthBounds, apertureBounds, tLenses]);

  const activeChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];

    for (const brand of filters.brands ?? []) {
      chips.push({
        id: `brand-${brand}`,
        label: brand,
        onRemove: () =>
          updateFilters({
            ...filters,
            brands: (filters.brands ?? []).filter((b) => b !== brand),
          }),
      });
    }
    for (const mount of filters.mounts ?? []) {
      chips.push({
        id: `mount-${mount}`,
        label: MOUNTS[mount].name,
        onRemove: () =>
          updateFilters({
            ...filters,
            mounts: (filters.mounts ?? []).filter((m) => m !== mount),
          }),
      });
    }
    if (filters.focalType) {
      chips.push({
        id: "focal-type",
        label:
          filters.focalType === "prime"
            ? tLenses("primeLabel")
            : tLenses("zoomLabel"),
        onRemove: () => updateFilters({ ...filters, focalType: undefined }),
      });
    }
    if (filters.minFocalLength != null || filters.maxFocalLength != null) {
      chips.push({
        id: "focal-length",
        label: tLenses("focalLengthChip", {
          min: filters.minFocalLength ?? focalLengthBounds[0],
          max: filters.maxFocalLength ?? focalLengthBounds[1],
        }),
        onRemove: () =>
          updateFilters({
            ...filters,
            minFocalLength: undefined,
            maxFocalLength: undefined,
          }),
      });
    }
    if (filters.maxAperture != null) {
      chips.push({
        id: "aperture",
        label: tLenses("maxApertureChip", { value: filters.maxAperture }),
        onRemove: () => updateFilters({ ...filters, maxAperture: undefined }),
      });
    }

    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateFilters closes over filters/pathname/router, which are already covered by their own deps
  }, [filters, focalLengthBounds, tLenses]);

  const displayedLenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return lenses;
    }
    return lenses.filter((lens) =>
      `${lens.brand} ${lens.model}`.toLowerCase().includes(normalizedQuery),
    );
  }, [lenses, query]);

  const hasActiveCriteria = activeChips.length > 0 || query.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="sm:w-80">
          <InputGroupAddon>
            <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tLenses("searchPlaceholder")}
            aria-label={tLenses("searchLabel")}
          />
        </InputGroup>
        <div className="md:hidden">
          <MobileFilterDrawer
            sections={sections}
            activeCount={activeChips.length}
            open={mobileFiltersOpen}
            onOpenChange={setMobileFiltersOpen}
            triggerLabel={tFilters("openLabel")}
            titleLabel={tFilters("title")}
            closeLabel={tFilters("closeLabel")}
            clearAllLabel={tFilters("clearAll")}
            onClearAll={() => updateFilters({})}
            applyLabel={tFilters("applyLabel", {
              count: displayedLenses.length,
            })}
            isPending={isPending}
            pendingLabel={tFilters("updatingLabel")}
          />
        </div>
      </div>

      <ActiveFilterBadges
        chips={activeChips}
        onClearAll={() => updateFilters({})}
        clearAllLabel={tFilters("clearAll")}
        removeLabel={(label) => tFilters("removeFilter", { label })}
        groupLabel={tFilters("activeFiltersLabel")}
      />

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <aside className="hidden shrink-0 md:block md:w-56">
          <FilterSidebar
            sections={sections}
            idPrefix="desktop-"
            isPending={isPending}
            pendingLabel={tFilters("updatingLabel")}
          />
        </aside>

        <div
          className={cn(
            "min-w-0 flex-1 transition-opacity",
            isPending && "pointer-events-none opacity-50",
          )}
          aria-busy={isPending}
          aria-live="polite"
        >
          {displayedLenses.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-base">
                {tLenses("noResults")}
              </p>
              {hasActiveCriteria && (
                <Button variant="outline" size="sm" onClick={resetAll}>
                  {tFilters("resetCta")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedLenses.map((lens) => (
                <CatalogItemCard
                  key={lens.slug}
                  href={`/lenses/${lens.slug}`}
                  compareHref={`/compare?items=${lens.slug}`}
                  eyebrow={MOUNTS[lens.mount].name}
                  title={`${lens.brand} ${lens.model}`}
                  meta={`${formatFocalLengthRange(lens.minFocalLengthMm, lens.maxFocalLengthMm)} · ${formatAperture(lens.maxAperture)}`}
                  viewSpecsLabel={tCatalog("viewSpecsCta")}
                  addToCompareLabel={tCatalog("addToCompareCta")}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
