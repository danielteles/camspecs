export type MountId =
  | "canon-rf"
  | "nikon-z"
  | "sony-e"
  | "fujifilm-x"
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
  releaseYear: number;
}
