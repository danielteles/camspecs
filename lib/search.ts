import { CAMERAS, LENSES } from "./mock-data";
import type { MountId } from "./types";

export type CatalogItemType = "camera" | "lens";

export interface CatalogItem {
  type: CatalogItemType;
  slug: string;
  brand: string;
  model: string;
  mount: MountId;
}

let catalogCache: CatalogItem[] | undefined;

function getCatalog(): CatalogItem[] {
  catalogCache ??= [
    ...CAMERAS.map((camera): CatalogItem => ({
      type: "camera",
      slug: camera.slug,
      brand: camera.brand,
      model: camera.model,
      mount: camera.mount,
    })),
    ...LENSES.map((lens): CatalogItem => ({
      type: "lens",
      slug: lens.slug,
      brand: lens.brand,
      model: lens.model,
      mount: lens.mount,
    })),
  ];

  return catalogCache;
}

/**
 * Case-insensitive substring search over brand + model. An empty or
 * whitespace-only query returns the full catalog.
 */
export function searchCatalog(query: string): CatalogItem[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return getCatalog();
  }

  return getCatalog().filter((item) =>
    `${item.brand} ${item.model}`.toLowerCase().includes(normalized),
  );
}

/**
 * Resolves a list of slugs to their catalog items, preserving the order of
 * `slugs` and silently dropping any that don't match a known item.
 */
export function resolveCatalogSlugs(slugs: string[]): CatalogItem[] {
  const bySlug = new Map(getCatalog().map((item) => [item.slug, item]));

  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((item): item is CatalogItem => item !== undefined);
}
