// Current mirrorless mounts only — DSLR/legacy mounts are intentionally out
// of scope, not unimplemented. See README.md's "Architecture: supported
// mounts" section for the full rationale and every other enforcement point.
export type MountId =
  | "canon-rf"
  | "nikon-z"
  | "sony-e"
  | "fujifilm-x"
  | "fujifilm-g"
  | "micro-four-thirds"
  | "l-mount"
  | "leica-m";

export interface Mount {
  id: MountId;
  name: string;
  /** Flange focal distance in millimeters. */
  flangeDistanceMm: number;
}

export interface SensorDimensions {
  widthMm: number;
  heightMm: number;
}

export const SENSOR_FORMATS = [
  "full-frame",
  "aps-c",
  "micro-four-thirds",
  "medium-format",
] as const;

export type SensorFormat = (typeof SENSOR_FORMATS)[number];

export function isSensorFormat(value: string): value is SensorFormat {
  return (SENSOR_FORMATS as readonly string[]).includes(value);
}

export interface Camera {
  slug: string;
  brand: string;
  model: string;
  mount: MountId;
  sensorFormat: SensorFormat;
  sensor: SensorDimensions;
  /** Not scraped for every model; the resolution filter treats null as "unknown, never matches". */
  megapixels: number | null;
  /** Not scraped for every model — Versus/Wikidata coverage of release dates is incomplete. */
  releaseYear: number | null;
  /** Not scraped for every model; the weight filter treats null as "unknown, never matches". */
  weightG: number | null;
  /** When the ETL scraper pipeline last synced this record's specs. */
  updatedAt: Date;
}

export interface Lens {
  slug: string;
  brand: string;
  model: string;
  mount: MountId;
  minFocalLengthMm: number;
  maxFocalLengthMm: number;
  maxAperture: number;
  minAperture: number;
  /** Not scraped for every model; the weight filter treats null as "unknown, never matches". */
  weightG: number | null;
  isPrime: boolean;
  /** Not scraped for every model — Versus/Wikidata coverage of release dates is incomplete. */
  releaseYear: number | null;
  /** When the ETL scraper pipeline last synced this record's specs. */
  updatedAt: Date;
}

// A filter field set to `undefined` means "not filtering on this", same as
// leaving it out: the catalogs clear a filter by spreading `{ field:
// undefined }`, and the serializers skip both alike.
export interface CameraFilters {
  brands?: string[];
  sensorFormats?: SensorFormat[];
  mounts?: MountId[];
  /** Inclusive lower bound. */
  minResolutionMp?: number | undefined;
  /** Inclusive upper bound. Rows with a null weight_g never match. */
  maxWeightG?: number | undefined;
}

export interface LensFilters {
  brands?: string[];
  mounts?: MountId[];
  focalType?: "prime" | "zoom" | undefined;
  /** Matches lenses whose focal range reaches at least this length. */
  minFocalLength?: number | undefined;
  /** Matches lenses whose focal range starts at or below this length. */
  maxFocalLength?: number | undefined;
  /** Inclusive upper bound on the f-number, e.g. 2.8 matches f/2.8 and faster. */
  maxAperture?: number | undefined;
}
