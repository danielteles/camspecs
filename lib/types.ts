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
  | "l-mount";

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

export type SensorFormat =
  "full-frame" | "aps-c" | "micro-four-thirds" | "medium-format";

export interface Camera {
  slug: string;
  brand: string;
  model: string;
  mount: MountId;
  sensorFormat: SensorFormat;
  sensor: SensorDimensions;
  megapixels: number;
  releaseYear: number;
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
  releaseYear: number;
  /** When the ETL scraper pipeline last synced this record's specs. */
  updatedAt: Date;
}
