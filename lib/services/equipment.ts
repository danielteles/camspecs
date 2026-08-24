import type { Kysely, Selectable } from "kysely";

import { getDb } from "@/lib/db/client";
import type { CamerasTable, Database, LensesTable } from "@/lib/db/schema";
import type { Camera, Lens, MountId, SensorFormat } from "@/lib/types";

// Re-derived from MountId rather than trusted from the DB column, which is
// a plain String with no enum constraint of its own (see
// scripts/scraper/db/schema.py) — this is the last line of defense against
// an unsupported (e.g. legacy DSLR) mount reaching a user. See README.md's
// "Architecture: supported mounts".
const MOUNT_IDS: ReadonlySet<string> = new Set<MountId>([
  "canon-rf",
  "nikon-z",
  "sony-e",
  "fujifilm-x",
  "fujifilm-g",
  "micro-four-thirds",
  "l-mount",
  "leica-m",
]);

const SENSOR_FORMATS: ReadonlySet<string> = new Set<SensorFormat>([
  "full-frame",
  "aps-c",
  "micro-four-thirds",
  "medium-format",
]);

function isMountId(value: string): value is MountId {
  return MOUNT_IDS.has(value);
}

function isSensorFormat(value: string): value is SensorFormat {
  return SENSOR_FORMATS.has(value);
}

// A row is only excluded here for a field the frontend's Camera/Lens types
// don't cover *at all* (a mount/sensor format outside the current unions)
// or that the site's core equivalence-calculator feature actually needs
// (sensor dimensions). A merely-missing display stat (megapixels,
// release_year — genuine, common upstream gaps, not a scraper bug: see
// scripts/scraper's data-completeness notes) passes through as null
// instead, so real gear with an incomplete spec sheet still shows up
// rather than vanishing from every listing.
function toCamera(row: Selectable<CamerasTable>): Camera | null {
  if (!isMountId(row.mount)) {
    console.warn(
      `[equipment] skipping camera "${row.slug}": unknown mount "${row.mount}"`,
    );
    return null;
  }
  if (!isSensorFormat(row.sensor_format)) {
    console.warn(
      `[equipment] skipping camera "${row.slug}": unknown sensor format "${row.sensor_format}"`,
    );
    return null;
  }
  if (row.sensor_width_mm == null || row.sensor_height_mm == null) {
    // Unlike megapixels/release_year below, this one still excludes the
    // row rather than passing null through: sensor dimensions feed the
    // site's core equivalence calculator (lib/equivalence.ts), so a camera
    // without them can't support the feature the site exists for, not just
    // display one missing stat.
    console.warn(
      `[equipment] skipping camera "${row.slug}": missing sensor dimensions`,
    );
    return null;
  }

  return {
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    mount: row.mount,
    sensorFormat: row.sensor_format,
    sensor: { widthMm: row.sensor_width_mm, heightMm: row.sensor_height_mm },
    megapixels: row.megapixels,
    releaseYear: row.release_year,
    weightG: row.weight_g,
    updatedAt: row.updated_at,
  };
}

function toLens(row: Selectable<LensesTable>): Lens | null {
  if (!isMountId(row.mount)) {
    console.warn(
      `[equipment] skipping lens "${row.slug}": unknown mount "${row.mount}"`,
    );
    return null;
  }
  return {
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    mount: row.mount,
    minFocalLengthMm: row.min_focal_length_mm,
    maxFocalLengthMm: row.max_focal_length_mm,
    maxAperture: row.max_aperture,
    minAperture: row.min_aperture,
    weightG: row.weight_g,
    isPrime: row.is_prime,
    releaseYear: row.release_year,
    updatedAt: row.updated_at,
  };
}

export interface CameraFilters {
  brands?: string[];
  sensorFormats?: SensorFormat[];
  mounts?: MountId[];
  /** Inclusive lower bound. */
  minResolutionMp?: number;
  /** Inclusive upper bound. Rows with a null weight_g never match. */
  maxWeightG?: number;
}

export type CameraSortKey = "brand" | "resolution" | "weight" | "release_date";

export interface EquipmentSort<K extends string> {
  key: K;
  direction?: "asc" | "desc";
}

export type CameraSort = EquipmentSort<CameraSortKey>;

// Maps sort keys to real columns through a fixed table rather than accepting
// a column name directly, so a sort key can never be used to inject
// arbitrary SQL into ORDER BY.
const CAMERA_SORT_COLUMNS: Record<CameraSortKey, keyof CamerasTable> = {
  brand: "brand",
  resolution: "megapixels",
  weight: "weight_g",
  release_date: "release_year",
};

/**
 * Builds the `cameras` SELECT with optional filters and sort applied, but
 * does not execute it — kept separate from getFilteredCameras so tests can
 * assert on the compiled SQL without a live database connection.
 */
export function buildCamerasQuery(
  db: Kysely<Database>,
  filters: CameraFilters = {},
  sort?: CameraSort,
) {
  let query = db.selectFrom("cameras").selectAll();

  // An empty array means "nothing selected", i.e. no filter — `where(col,
  // "in", [])` would instead compile to an always-false clause and hide
  // every row.
  if (filters.brands && filters.brands.length > 0) {
    query = query.where("brand", "in", filters.brands);
  }
  if (filters.sensorFormats && filters.sensorFormats.length > 0) {
    query = query.where("sensor_format", "in", filters.sensorFormats);
  }
  if (filters.mounts && filters.mounts.length > 0) {
    query = query.where("mount", "in", filters.mounts);
  }
  if (filters.minResolutionMp != null) {
    query = query.where("megapixels", ">=", filters.minResolutionMp);
  }
  if (filters.maxWeightG != null) {
    query = query.where("weight_g", "<=", filters.maxWeightG);
  }

  const sortColumn = CAMERA_SORT_COLUMNS[sort?.key ?? "brand"];
  const direction = sort?.direction ?? "asc";
  query = query.orderBy(sortColumn, direction);
  // brand/model as a stable tie-breaker under any primary sort, matching
  // the fixed ordering getAllCameras used before sorting was configurable.
  if (sortColumn !== "brand") {
    query = query.orderBy("brand", "asc");
  }
  query = query.orderBy("model", "asc");

  return query;
}

export async function getFilteredCameras(
  filters: CameraFilters = {},
  sort?: CameraSort,
): Promise<Camera[]> {
  const rows = await buildCamerasQuery(getDb(), filters, sort).execute();
  return rows
    .map(toCamera)
    .filter((camera): camera is Camera => camera !== null);
}

export async function getAllCameras(): Promise<Camera[]> {
  return getFilteredCameras();
}

export interface LensFilters {
  brands?: string[];
  mounts?: MountId[];
  focalType?: "prime" | "zoom";
  /** Matches lenses whose focal range reaches at least this length. */
  minFocalLength?: number;
  /** Matches lenses whose focal range starts at or below this length. */
  maxFocalLength?: number;
  /** Inclusive upper bound on the f-number, e.g. 2.8 matches f/2.8 and faster. */
  maxAperture?: number;
}

export type LensSortKey =
  "brand" | "focal_length" | "aperture" | "release_date";
export type LensSort = EquipmentSort<LensSortKey>;

const LENS_SORT_COLUMNS: Record<LensSortKey, keyof LensesTable> = {
  brand: "brand",
  focal_length: "min_focal_length_mm",
  aperture: "max_aperture",
  release_date: "release_year",
};

/**
 * Builds the `lenses` SELECT with optional filters and sort applied, but
 * does not execute it — kept separate from getFilteredLenses so tests can
 * assert on the compiled SQL without a live database connection.
 */
export function buildLensesQuery(
  db: Kysely<Database>,
  filters: LensFilters = {},
  sort?: LensSort,
) {
  let query = db.selectFrom("lenses").selectAll();

  if (filters.brands && filters.brands.length > 0) {
    query = query.where("brand", "in", filters.brands);
  }
  if (filters.mounts && filters.mounts.length > 0) {
    query = query.where("mount", "in", filters.mounts);
  }
  if (filters.focalType) {
    query = query.where("is_prime", "=", filters.focalType === "prime");
  }
  // Focal length is stored as a [min, max] range per lens (a prime has
  // min === max); a requested [minFocalLength, maxFocalLength] range
  // matches any lens whose range overlaps it, not just an exact fit.
  if (filters.minFocalLength != null) {
    query = query.where("max_focal_length_mm", ">=", filters.minFocalLength);
  }
  if (filters.maxFocalLength != null) {
    query = query.where("min_focal_length_mm", "<=", filters.maxFocalLength);
  }
  if (filters.maxAperture != null) {
    query = query.where("max_aperture", "<=", filters.maxAperture);
  }

  const sortColumn = LENS_SORT_COLUMNS[sort?.key ?? "brand"];
  const direction = sort?.direction ?? "asc";
  query = query.orderBy(sortColumn, direction);
  if (sortColumn !== "brand") {
    query = query.orderBy("brand", "asc");
  }
  query = query.orderBy("model", "asc");

  return query;
}

export async function getFilteredLenses(
  filters: LensFilters = {},
  sort?: LensSort,
): Promise<Lens[]> {
  const rows = await buildLensesQuery(getDb(), filters, sort).execute();
  return rows.map(toLens).filter((lens): lens is Lens => lens !== null);
}

export async function getAllLenses(): Promise<Lens[]> {
  return getFilteredLenses();
}

export async function getCameraBySlug(slug: string): Promise<Camera | null> {
  const row = await getDb()
    .selectFrom("cameras")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? toCamera(row) : null;
}

export async function getLensBySlug(slug: string): Promise<Lens | null> {
  const row = await getDb()
    .selectFrom("lenses")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? toLens(row) : null;
}

export interface EquipmentFilters {
  mount?: MountId;
}

export type EquipmentSearchResult =
  { type: "camera"; item: Camera } | { type: "lens"; item: Lens };

// Simple substring match over brand + model, shared across both catalogs.
// This is a Step 1 placeholder to prove the service layer end-to-end; it
// will be reconciled with the existing catalog UI in Step 2.
export async function searchEquipment(
  query: string,
  filters: EquipmentFilters = {},
): Promise<EquipmentSearchResult[]> {
  const [cameras, lenses] = await Promise.all([
    getAllCameras(),
    getAllLenses(),
  ]);
  const q = query.trim().toLowerCase();
  const matches = (brand: string, model: string) =>
    q.length === 0 || `${brand} ${model}`.toLowerCase().includes(q);

  const results: EquipmentSearchResult[] = [];
  for (const camera of cameras) {
    if (
      (!filters.mount || camera.mount === filters.mount) &&
      matches(camera.brand, camera.model)
    ) {
      results.push({ type: "camera", item: camera });
    }
  }
  for (const lens of lenses) {
    if (
      (!filters.mount || lens.mount === filters.mount) &&
      matches(lens.brand, lens.model)
    ) {
      results.push({ type: "lens", item: lens });
    }
  }
  return results;
}
