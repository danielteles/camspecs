import type { ColumnType } from "kysely";

/**
 * Mirrors scripts/scraper/db/schema.py's `cameras` / `lenses` tables. The
 * Python pipeline owns migrations (SQLAlchemy `create_all`); this file just
 * describes the resulting shape for Kysely's query builder.
 */

type Timestamp = ColumnType<Date, string | Date, string | Date>;
// `Generated<Timestamp>` would nest a ColumnType inside another ColumnType's
// select-type slot — Kysely's Selectable<> only unwraps one level, so that
// resolves to the Timestamp type itself instead of Date. Define the
// generated (optional-on-insert) variant directly instead.
type GeneratedTimestamp = ColumnType<
  Date,
  string | Date | undefined,
  string | Date
>;

export interface CamerasTable {
  slug: string;
  brand: string;
  model: string;
  mount: string;
  sensor_format: string;
  sensor_width_mm: number | null;
  sensor_height_mm: number | null;
  megapixels: number | null;
  release_year: number | null;
  weight_g: number | null;
  crop_factor: number | null;
  video_formats: string[];
  source: string;
  source_url: string | null;
  scraped_at: Timestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface LensesTable {
  slug: string;
  brand: string;
  model: string;
  mount: string;
  min_focal_length_mm: number;
  max_focal_length_mm: number;
  min_aperture: number;
  max_aperture: number;
  weight_g: number | null;
  is_prime: boolean;
  release_year: number | null;
  source: string;
  source_url: string | null;
  scraped_at: Timestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface Database {
  cameras: CamerasTable;
  lenses: LensesTable;
}
