import type { Camera, Lens, MountId } from "./types";

export type CatalogItemType = "camera" | "lens";

export interface CatalogItem {
  type: CatalogItemType;
  slug: string;
  brand: string;
  model: string;
  mount: MountId;
}

/** The search/chip fields of one camera or lens. */
export function toCatalogItem(
  type: CatalogItemType,
  { slug, brand, model, mount }: Camera | Lens,
): CatalogItem {
  return { type, slug, brand, model, mount };
}

/** Flattens the camera and lens catalogs into the shape the compare
 * selector's search/resolve functions operate on. */
export function buildCatalog(cameras: Camera[], lenses: Lens[]): CatalogItem[] {
  return [
    ...cameras.map((camera) => toCatalogItem("camera", camera)),
    ...lenses.map((lens) => toCatalogItem("lens", lens)),
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
