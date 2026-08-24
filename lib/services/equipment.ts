import type { Selectable } from "kysely";

import { getDb } from "@/lib/db/client";
import type { CamerasTable, LensesTable } from "@/lib/db/schema";
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

// The scraper's schema allows values the frontend's Camera/Lens types
// don't cover yet (nullable specs, mounts/sensor formats outside the
// current unions). Rather than fake defaults, skip those rows here — at
// the DB boundary — and log why, so callers only ever see fully-typed data.
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
    console.warn(
      `[equipment] skipping camera "${row.slug}": missing sensor dimensions`,
    );
    return null;
  }
  if (row.megapixels == null) {
    console.warn(
      `[equipment] skipping camera "${row.slug}": missing megapixels`,
    );
    return null;
  }
  if (row.release_year == null) {
    console.warn(
      `[equipment] skipping camera "${row.slug}": missing release year`,
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
  if (row.release_year == null) {
    console.warn(
      `[equipment] skipping lens "${row.slug}": missing release year`,
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
    releaseYear: row.release_year,
    updatedAt: row.updated_at,
  };
}

export async function getAllCameras(): Promise<Camera[]> {
  const rows = await getDb()
    .selectFrom("cameras")
    .selectAll()
    .orderBy("brand")
    .orderBy("model")
    .execute();
  return rows
    .map(toCamera)
    .filter((camera): camera is Camera => camera !== null);
}

export async function getAllLenses(): Promise<Lens[]> {
  const rows = await getDb()
    .selectFrom("lenses")
    .selectAll()
    .orderBy("brand")
    .orderBy("model")
    .execute();
  return rows.map(toLens).filter((lens): lens is Lens => lens !== null);
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
