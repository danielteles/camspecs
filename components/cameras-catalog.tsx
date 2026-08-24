"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  parseCameraFilters,
  serializeCameraFilters,
} from "@/lib/catalog-params";
import { cameraMatchesFilters, countByFacet } from "@/lib/catalog-filtering";
import {
  SENSOR_FORMAT_BADGE_VARIANT,
  SENSOR_FORMAT_KEYS,
} from "@/lib/compare-data";
import { MOUNTS } from "@/lib/mounts";
import type { CameraFilters } from "@/lib/services/equipment";
import type { Camera, MountId, SensorFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CamerasCatalogProps {
  /** Already filtered server-side (real SQL WHERE) by the current URL params. */
  cameras: Camera[];
  /** The full, unfiltered catalog — used only to enumerate facet options and counts. */
  allCameras: Camera[];
}

function bounds(
  values: number[],
  fallback: [number, number],
): [number, number] {
  if (values.length === 0) {
    return fallback;
  }
  return [Math.min(...values), Math.max(...values)];
}

export function CamerasCatalog({ cameras, allCameras }: CamerasCatalogProps) {
  const t = useTranslations();
  const tCatalog = useTranslations("Catalog");
  const tCameras = useTranslations("Catalog.cameras");
  const tFilters = useTranslations("Filters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = useMemo(
    () => parseCameraFilters(searchParams),
    [searchParams],
  );

  function updateFilters(next: CameraFilters) {
    const nextQuery = serializeCameraFilters(next);
    const href =
      Object.keys(nextQuery).length > 0
        ? { pathname, query: nextQuery }
        : { pathname };
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  const resolutionBounds = useMemo(
    () =>
      bounds(
        allCameras.map((c) => c.megapixels),
        [0, 100],
      ),
    [allCameras],
  );
  const weightValues = useMemo(
    () =>
      allCameras.map((c) => c.weightG).filter((w): w is number => w != null),
    [allCameras],
  );
  const weightBounds = useMemo(
    () => bounds(weightValues, [0, 2000]),
    [weightValues],
  );

  const sections: FilterSection[] = useMemo(() => {
    const brandCounts = countByFacet(
      allCameras,
      filters,
      "brands",
      cameraMatchesFilters,
      (c) => c.brand,
    );
    const brandOptions = Array.from(new Set(allCameras.map((c) => c.brand)))
      .sort()
      .map((brand) => ({
        value: brand,
        label: brand,
        count: brandCounts.get(brand) ?? 0,
      }));

    const sensorCounts = countByFacet(
      allCameras,
      filters,
      "sensorFormats",
      cameraMatchesFilters,
      (c) => c.sensorFormat,
    );
    const sensorOptions = Array.from(
      new Set(allCameras.map((c) => c.sensorFormat)),
    ).map((format) => ({
      value: format,
      label: t(SENSOR_FORMAT_KEYS[format]),
      count: sensorCounts.get(format) ?? 0,
    }));

    const mountCounts = countByFacet(
      allCameras,
      filters,
      "mounts",
      cameraMatchesFilters,
      (c) => c.mount,
    );
    const mountOptions = Array.from(
      new Set(allCameras.map((c) => c.mount)),
    ).map((mount) => ({
      value: mount,
      label: MOUNTS[mount].name,
      count: mountCounts.get(mount) ?? 0,
    }));

    const result: FilterSection[] = [
      {
        type: "checkbox",
        id: "brand",
        label: tCameras("brandFilterLabel"),
        options: brandOptions,
        selected: filters.brands ?? [],
        onChange: (selected) => updateFilters({ ...filters, brands: selected }),
      },
      {
        type: "checkbox",
        id: "sensor",
        label: tCameras("sensorFormatFilterLabel"),
        options: sensorOptions,
        selected: filters.sensorFormats ?? [],
        onChange: (selected) =>
          updateFilters({
            ...filters,
            sensorFormats: selected as SensorFormat[],
          }),
      },
      {
        type: "checkbox",
        id: "mount",
        label: tCameras("mountFilterLabel"),
        options: mountOptions,
        selected: filters.mounts ?? [],
        onChange: (selected) =>
          updateFilters({ ...filters, mounts: selected as MountId[] }),
      },
      {
        type: "range",
        id: "resolution",
        label: tCameras("minResolutionFilterLabel"),
        min: resolutionBounds[0],
        max: resolutionBounds[1],
        step: 1,
        value: [filters.minResolutionMp ?? resolutionBounds[0]],
        onChange: ([value]) =>
          updateFilters({
            ...filters,
            minResolutionMp: value === resolutionBounds[0] ? undefined : value,
          }),
        formatValue: (value) => `${value} MP`,
      },
    ];

    if (weightValues.length > 0) {
      result.push({
        type: "range",
        id: "weight",
        label: tCameras("maxWeightFilterLabel"),
        min: weightBounds[0],
        max: weightBounds[1],
        step: 10,
        value: [filters.maxWeightG ?? weightBounds[1]],
        onChange: ([value]) =>
          updateFilters({
            ...filters,
            maxWeightG: value === weightBounds[1] ? undefined : value,
          }),
        formatValue: (value) => `${value} g`,
      });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateFilters closes over filters/pathname/router, which are already covered by their own deps
  }, [
    allCameras,
    filters,
    resolutionBounds,
    weightBounds,
    weightValues,
    t,
    tCameras,
  ]);

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
    for (const format of filters.sensorFormats ?? []) {
      chips.push({
        id: `sensor-${format}`,
        label: t(SENSOR_FORMAT_KEYS[format]),
        onRemove: () =>
          updateFilters({
            ...filters,
            sensorFormats: (filters.sensorFormats ?? []).filter(
              (f) => f !== format,
            ),
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
    if (filters.minResolutionMp != null) {
      chips.push({
        id: "resolution",
        label: tCameras("minResolutionChip", {
          value: filters.minResolutionMp,
        }),
        onRemove: () =>
          updateFilters({ ...filters, minResolutionMp: undefined }),
      });
    }
    if (filters.maxWeightG != null) {
      chips.push({
        id: "weight",
        label: tCameras("maxWeightChip", { value: filters.maxWeightG }),
        onRemove: () => updateFilters({ ...filters, maxWeightG: undefined }),
      });
    }

    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateFilters closes over filters/pathname/router, which are already covered by their own deps
  }, [filters, t, tCameras]);

  const displayedCameras = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return cameras;
    }
    return cameras.filter((camera) =>
      `${camera.brand} ${camera.model}`.toLowerCase().includes(normalizedQuery),
    );
  }, [cameras, query]);

  function resetAll() {
    setQuery("");
    updateFilters({});
  }

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
            placeholder={tCameras("searchPlaceholder")}
            aria-label={tCameras("searchLabel")}
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
              count: displayedCameras.length,
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
          {displayedCameras.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-base">
                {tCameras("noResults")}
              </p>
              {hasActiveCriteria && (
                <Button variant="outline" size="sm" onClick={resetAll}>
                  {tFilters("resetCta")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedCameras.map((camera) => (
                <CatalogItemCard
                  key={camera.slug}
                  href={`/cameras/${camera.slug}`}
                  compareHref={`/compare?items=${camera.slug}`}
                  eyebrow={MOUNTS[camera.mount].name}
                  title={`${camera.brand} ${camera.model}`}
                  meta={`${camera.megapixels} MP · ${camera.releaseYear}`}
                  badgeLabel={t(SENSOR_FORMAT_KEYS[camera.sensorFormat])}
                  badgeVariant={
                    SENSOR_FORMAT_BADGE_VARIANT[camera.sensorFormat]
                  }
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
