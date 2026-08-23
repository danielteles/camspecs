import type { Camera, Lens, MountId } from "./types";

export type CatalogItemType = "camera" | "lens";

export interface CatalogItem {
  type: CatalogItemType;
  slug: string;
  brand: string;
  model: string;
  mount: MountId;
}

/** Flattens the camera and lens catalogs into the shape the compare
 * selector's search/resolve functions operate on. */
export function buildCatalog(cameras: Camera[], lenses: Lens[]): CatalogItem[] {
  return [
    ...cameras.map((camera): CatalogItem => ({
      type: "camera",
      slug: camera.slug,
      brand: camera.brand,
      model: camera.model,
      mount: camera.mount,
    })),
    ...lenses.map((lens): CatalogItem => ({
      type: "lens",
      slug: lens.slug,
      brand: lens.brand,
      model: lens.model,
      mount: lens.mount,
    })),
  ];
}

/**
 * Case-insensitive substring search over brand + model. An empty or
 * whitespace-only query returns the full catalog.
 */
export function searchCatalog(
  catalog: CatalogItem[],
  query: string,
): CatalogItem[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return catalog;
  }

  return catalog.filter((item) =>
    `${item.brand} ${item.model}`.toLowerCase().includes(normalized),
  );
}

/**
 * Resolves a list of slugs to their catalog items, preserving the order of
 * `slugs` and silently dropping any that don't match a known item.
 */
export function resolveCatalogSlugs(
  catalog: CatalogItem[],
  slugs: string[],
): CatalogItem[] {
  const bySlug = new Map(catalog.map((item) => [item.slug, item]));

  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((item): item is CatalogItem => item !== undefined);
}
