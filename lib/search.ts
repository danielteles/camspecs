import { isMountId } from "./mounts";
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

function isCatalogItem(value: unknown): value is CatalogItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    (item.type === "camera" || item.type === "lens") &&
    typeof item.slug === "string" &&
    typeof item.brand === "string" &&
    typeof item.model === "string" &&
    typeof item.mount === "string" &&
    isMountId(item.mount)
  );
}

/**
 * Narrows an `/api/catalog` response body to its items, or `undefined`
 * when the body isn't the `{ items }` shape (e.g. an error payload or a
 * stale cached response) — the client treats that as a failed load rather
 * than trusting it.
 */
export function parseCatalogResponse(data: unknown): CatalogItem[] | undefined {
  if (typeof data !== "object" || data === null || !("items" in data)) {
    return undefined;
  }
  const { items } = data;
  return Array.isArray(items) ? items.filter(isCatalogItem) : undefined;
}
