import type { SensorDimensions } from "./types";

/** Reference sensor (36mm x 24mm) that crop factors are calculated against. */
export const FULL_FRAME_SENSOR: SensorDimensions = {
  widthMm: 36,
  heightMm: 24,
};

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive, finite number.`);
  }
}

/**
 * Diagonal measurement of a sensor, in millimeters.
 */
export function getSensorDiagonalMm(sensor: SensorDimensions): number {
  assertPositive(sensor.widthMm, "sensor.widthMm");
  assertPositive(sensor.heightMm, "sensor.heightMm");

  return Math.sqrt(sensor.widthMm ** 2 + sensor.heightMm ** 2);
}

/**
 * Crop factor of `sensor` relative to `referenceSensor` (35mm full-frame by
 * default), derived from the ratio of sensor diagonals.
 */
export function getCropFactor(
  sensor: SensorDimensions,
  referenceSensor: SensorDimensions = FULL_FRAME_SENSOR,
): number {
  return getSensorDiagonalMm(referenceSensor) / getSensorDiagonalMm(sensor);
}

/**
 * 35mm-equivalent focal length for a lens mounted on a sensor with the given
 * crop factor.
 */
export function getEquivalentFocalLength(
  focalLengthMm: number,
  cropFactor: number,
): number {
  assertPositive(focalLengthMm, "focalLengthMm");
  assertPositive(cropFactor, "cropFactor");

  return focalLengthMm * cropFactor;
}

/**
 * 35mm-equivalent aperture for depth-of-field comparison purposes. This
 * reflects the well-known "f-stop equivalence" used to compare background
 * blur/depth of field across sensor formats; it is not a statement about
 * exposure, which is unaffected by sensor size.
 */
export function getEquivalentAperture(
  aperture: number,
  cropFactor: number,
): number {
  assertPositive(aperture, "aperture");
  assertPositive(cropFactor, "cropFactor");

  return aperture * cropFactor;
}

/**
 * Angle of view, in degrees, for a rectilinear lens of `focalLengthMm`
 * projected onto a sensor dimension of `sensorDimensionMm` (width, height,
 * or diagonal).
 */
export function getFieldOfViewDegrees(
  focalLengthMm: number,
  sensorDimensionMm: number,
): number {
  assertPositive(focalLengthMm, "focalLengthMm");
  assertPositive(sensorDimensionMm, "sensorDimensionMm");

  return (
    2 * Math.atan(sensorDimensionMm / (2 * focalLengthMm)) * (180 / Math.PI)
  );
}

/** Horizontal angle of view, in degrees, for a lens on a given sensor. */
export function getHorizontalFieldOfView(
  focalLengthMm: number,
  sensor: SensorDimensions,
): number {
  return getFieldOfViewDegrees(focalLengthMm, sensor.widthMm);
}

/** Vertical angle of view, in degrees, for a lens on a given sensor. */
export function getVerticalFieldOfView(
  focalLengthMm: number,
  sensor: SensorDimensions,
): number {
  return getFieldOfViewDegrees(focalLengthMm, sensor.heightMm);
}

/** Diagonal angle of view, in degrees, for a lens on a given sensor. */
export function getDiagonalFieldOfView(
  focalLengthMm: number,
  sensor: SensorDimensions,
): number {
  return getFieldOfViewDegrees(focalLengthMm, getSensorDiagonalMm(sensor));
}
