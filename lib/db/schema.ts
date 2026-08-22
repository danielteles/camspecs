import type { ColumnType, Generated } from "kysely";

/**
 * Mirrors scripts/scraper/db/schema.py's `cameras` / `lenses` tables. The
 * Python pipeline owns migrations (SQLAlchemy `create_all`); this file just
 * describes the resulting shape for Kysely's query builder.
 */

type Timestamp = ColumnType<Date, string | Date, string | Date>;

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
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
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
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface Database {
  cameras: CamerasTable;
  lenses: LensesTable;
}
