import type { CameraFilters, LensFilters } from "./services/equipment";
import type { MountId, SensorFormat } from "./types";

/**
 * Converts Next.js's server-side `searchParams` shape (a plain object,
 * possibly with repeated-key arrays) into a `URLSearchParams` so the same
 * parse functions serve both the server component (page.tsx) and client
 * components (`useSearchParams()` already returns `URLSearchParams`).
 */
export function searchParamsFromRecord(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue;
    }
    for (const v of Array.isArray(value) ? value : [value]) {
      params.append(key, v);
    }
  }
  return params;
}

function parseList(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
}

function parseNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const CAMERA_PARAM_KEYS = {
  brands: "brand",
  sensorFormats: "sensor",
  mounts: "mount",
  minResolutionMp: "min_megapixels",
  maxWeightG: "max_weight",
} as const;

export function parseCameraFilters(params: URLSearchParams): CameraFilters {
  const filters: CameraFilters = {};

  const brands = parseList(params.get(CAMERA_PARAM_KEYS.brands));
  if (brands.length > 0) {
    filters.brands = brands;
  }

  const sensorFormats = parseList(
    params.get(CAMERA_PARAM_KEYS.sensorFormats),
  ) as SensorFormat[];
  if (sensorFormats.length > 0) {
    filters.sensorFormats = sensorFormats;
  }

  const mounts = parseList(params.get(CAMERA_PARAM_KEYS.mounts)) as MountId[];
  if (mounts.length > 0) {
    filters.mounts = mounts;
  }

  const minResolutionMp = parseNumber(
    params.get(CAMERA_PARAM_KEYS.minResolutionMp),
  );
  if (minResolutionMp !== undefined) {
    filters.minResolutionMp = minResolutionMp;
  }

  const maxWeightG = parseNumber(params.get(CAMERA_PARAM_KEYS.maxWeightG));
  if (maxWeightG !== undefined) {
    filters.maxWeightG = maxWeightG;
  }

  return filters;
}

/** Builds a plain params object for next-intl's router `query`, omitting
 * any key whose filter isn't set (an explicit `undefined` value would
 * still serialize as the literal string "undefined"). */
export function serializeCameraFilters(
  filters: CameraFilters,
): Record<string, string> {
  const query: Record<string, string> = {};

  if (filters.brands && filters.brands.length > 0) {
    query[CAMERA_PARAM_KEYS.brands] = filters.brands.join(",");
  }
  if (filters.sensorFormats && filters.sensorFormats.length > 0) {
    query[CAMERA_PARAM_KEYS.sensorFormats] = filters.sensorFormats.join(",");
  }
  if (filters.mounts && filters.mounts.length > 0) {
    query[CAMERA_PARAM_KEYS.mounts] = filters.mounts.join(",");
  }
  if (filters.minResolutionMp != null) {
    query[CAMERA_PARAM_KEYS.minResolutionMp] = String(filters.minResolutionMp);
  }
  if (filters.maxWeightG != null) {
    query[CAMERA_PARAM_KEYS.maxWeightG] = String(filters.maxWeightG);
  }

  return query;
}

export const LENS_PARAM_KEYS = {
  brands: "brand",
  mounts: "mount",
  focalType: "focal_type",
  minFocalLength: "min_focal",
  maxFocalLength: "max_focal",
  maxAperture: "max_aperture",
} as const;

function isFocalType(value: string | null): value is "prime" | "zoom" {
  return value === "prime" || value === "zoom";
}

export function parseLensFilters(params: URLSearchParams): LensFilters {
  const filters: LensFilters = {};

  const brands = parseList(params.get(LENS_PARAM_KEYS.brands));
  if (brands.length > 0) {
    filters.brands = brands;
  }

  const mounts = parseList(params.get(LENS_PARAM_KEYS.mounts)) as MountId[];
  if (mounts.length > 0) {
    filters.mounts = mounts;
  }

  const focalType = params.get(LENS_PARAM_KEYS.focalType);
  if (isFocalType(focalType)) {
    filters.focalType = focalType;
  }

  const minFocalLength = parseNumber(
    params.get(LENS_PARAM_KEYS.minFocalLength),
  );
  if (minFocalLength !== undefined) {
    filters.minFocalLength = minFocalLength;
  }

  const maxFocalLength = parseNumber(
    params.get(LENS_PARAM_KEYS.maxFocalLength),
  );
  if (maxFocalLength !== undefined) {
    filters.maxFocalLength = maxFocalLength;
  }

  const maxAperture = parseNumber(params.get(LENS_PARAM_KEYS.maxAperture));
  if (maxAperture !== undefined) {
    filters.maxAperture = maxAperture;
  }

  return filters;
}

export function serializeLensFilters(
  filters: LensFilters,
): Record<string, string> {
  const query: Record<string, string> = {};

  if (filters.brands && filters.brands.length > 0) {
    query[LENS_PARAM_KEYS.brands] = filters.brands.join(",");
  }
  if (filters.mounts && filters.mounts.length > 0) {
    query[LENS_PARAM_KEYS.mounts] = filters.mounts.join(",");
  }
  if (filters.focalType) {
    query[LENS_PARAM_KEYS.focalType] = filters.focalType;
  }
  if (filters.minFocalLength != null) {
    query[LENS_PARAM_KEYS.minFocalLength] = String(filters.minFocalLength);
  }
  if (filters.maxFocalLength != null) {
    query[LENS_PARAM_KEYS.maxFocalLength] = String(filters.maxFocalLength);
  }
  if (filters.maxAperture != null) {
    query[LENS_PARAM_KEYS.maxAperture] = String(filters.maxAperture);
  }

  return query;
}
