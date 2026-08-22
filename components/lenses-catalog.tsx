"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { CatalogItemCard } from "@/components/catalog-item-card";
import { FilterChipGroup } from "@/components/filter-chip-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { formatAperture, formatFocalLengthRange } from "@/lib/compare-data";
import { MOUNTS } from "@/lib/mounts";
import type { Lens, MountId } from "@/lib/types";

interface LensesCatalogProps {
  lenses: Lens[];
}

export function LensesCatalog({ lenses }: LensesCatalogProps) {
  const tCatalog = useTranslations("Catalog");
  const tLenses = useTranslations("Catalog.lenses");
  const [query, setQuery] = useState("");
  const [mount, setMount] = useState<MountId | "all">("all");

  const mountOptions = useMemo(() => {
    const mountIds = Array.from(new Set(lenses.map((lens) => lens.mount)));
    return mountIds.map((mountId) => ({
      value: mountId,
      label: MOUNTS[mountId].name,
    }));
  }, [lenses]);

  const filteredLenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return lenses.filter((lens) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${lens.brand} ${lens.model}`.toLowerCase().includes(normalizedQuery);
      const matchesMount = mount === "all" || lens.mount === mount;
      return matchesQuery && matchesMount;
    });
  }, [lenses, query, mount]);

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
        <FilterChipGroup
          label={tLenses("mountFilterLabel")}
          value={mount}
          onChange={(value) => setMount(value as MountId | "all")}
          options={[
            { value: "all", label: tCatalog("allFilter") },
            ...mountOptions,
          ]}
        />
      </div>

      {filteredLenses.length === 0 ? (
        <p className="text-muted-foreground text-base">
          {tLenses("noResults")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLenses.map((lens) => (
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
  );
}
