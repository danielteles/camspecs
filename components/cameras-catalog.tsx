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
import {
  SENSOR_FORMAT_BADGE_VARIANT,
  SENSOR_FORMAT_KEYS,
} from "@/lib/compare-data";
import { MOUNTS } from "@/lib/mock-data";
import type { Camera, SensorFormat } from "@/lib/types";

interface CamerasCatalogProps {
  cameras: Camera[];
}

export function CamerasCatalog({ cameras }: CamerasCatalogProps) {
  const t = useTranslations();
  const tCatalog = useTranslations("Catalog");
  const tCameras = useTranslations("Catalog.cameras");
  const [query, setQuery] = useState("");
  const [sensorFormat, setSensorFormat] = useState<SensorFormat | "all">("all");

  const sensorFormatOptions = useMemo(() => {
    const formats = Array.from(
      new Set(cameras.map((camera) => camera.sensorFormat)),
    );
    return formats.map((format) => ({
      value: format,
      label: t(SENSOR_FORMAT_KEYS[format]),
    }));
  }, [cameras, t]);

  const filteredCameras = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cameras.filter((camera) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        `${camera.brand} ${camera.model}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesFormat =
        sensorFormat === "all" || camera.sensorFormat === sensorFormat;
      return matchesQuery && matchesFormat;
    });
  }, [cameras, query, sensorFormat]);

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
        <FilterChipGroup
          label={tCameras("sensorFormatFilterLabel")}
          value={sensorFormat}
          onChange={(value) => setSensorFormat(value as SensorFormat | "all")}
          options={[
            { value: "all", label: tCatalog("allFilter") },
            ...sensorFormatOptions,
          ]}
        />
      </div>

      {filteredCameras.length === 0 ? (
        <p className="text-muted-foreground text-base">
          {tCameras("noResults")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCameras.map((camera) => (
            <CatalogItemCard
              key={camera.slug}
              href={`/cameras/${camera.slug}`}
              compareHref={`/compare?items=${camera.slug}`}
              eyebrow={MOUNTS[camera.mount].name}
              title={`${camera.brand} ${camera.model}`}
              meta={`${camera.megapixels} MP · ${camera.releaseYear}`}
              badgeLabel={t(SENSOR_FORMAT_KEYS[camera.sensorFormat])}
              badgeVariant={SENSOR_FORMAT_BADGE_VARIANT[camera.sensorFormat]}
              viewSpecsLabel={tCatalog("viewSpecsCta")}
              addToCompareLabel={tCatalog("addToCompareCta")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
