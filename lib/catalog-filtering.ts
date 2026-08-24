import type { CameraFilters, LensFilters } from "./services/equipment";
import type { Camera, Lens } from "./types";

/**
 * Mirrors buildCamerasQuery's WHERE semantics (lib/services/equipment.ts)
 * in plain TypeScript so the same rules can run client-side, over the full
 * unfiltered catalog, purely to compute facet option counts — the actual
 * filtered result set always comes from the real SQL query.
 */
export function cameraMatchesFilters(
  camera: Camera,
  filters: CameraFilters,
): boolean {
  if (
    filters.brands &&
    filters.brands.length > 0 &&
    !filters.brands.includes(camera.brand)
  ) {
    return false;
  }
  if (
    filters.sensorFormats &&
    filters.sensorFormats.length > 0 &&
    !filters.sensorFormats.includes(camera.sensorFormat)
  ) {
    return false;
  }
  if (
    filters.mounts &&
    filters.mounts.length > 0 &&
    !filters.mounts.includes(camera.mount)
  ) {
    return false;
  }
  if (
    filters.minResolutionMp != null &&
    camera.megapixels < filters.minResolutionMp
  ) {
    return false;
  }
  if (
    filters.maxWeightG != null &&
    (camera.weightG == null || camera.weightG > filters.maxWeightG)
  ) {
    return false;
  }
  return true;
}

/** Mirrors buildLensesQuery's WHERE semantics; see cameraMatchesFilters. */
export function lensMatchesFilters(lens: Lens, filters: LensFilters): boolean {
  if (
    filters.brands &&
    filters.brands.length > 0 &&
    !filters.brands.includes(lens.brand)
  ) {
    return false;
  }
  if (
    filters.mounts &&
    filters.mounts.length > 0 &&
    !filters.mounts.includes(lens.mount)
  ) {
    return false;
  }
  if (filters.focalType && lens.isPrime !== (filters.focalType === "prime")) {
    return false;
  }
  if (
    filters.minFocalLength != null &&
    lens.maxFocalLengthMm < filters.minFocalLength
  ) {
    return false;
  }
  if (
    filters.maxFocalLength != null &&
    lens.minFocalLengthMm > filters.maxFocalLength
  ) {
    return false;
  }
  if (filters.maxAperture != null && lens.maxAperture > filters.maxAperture) {
    return false;
  }
  return true;
}

/**
 * Counts items per facet value, as if every *other* active filter still
 * applied but `excludeKey` didn't — the standard faceted-search semantic
 * ("how many results would this option leave, given everything else I've
 * already picked") rather than a static count against the whole catalog.
 */
export function countByFacet<Item, Filters extends object>(
  items: Item[],
  filters: Filters,
  excludeKey: keyof Filters,
  matches: (item: Item, filters: Filters) => boolean,
  getValue: (item: Item) => string,
): Map<string, number> {
  const narrowedFilters = { ...filters, [excludeKey]: undefined };
  const counts = new Map<string, number>();

  for (const item of items) {
    if (matches(item, narrowedFilters)) {
      const value = getValue(item);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return counts;
}
