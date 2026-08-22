import type { getTranslations } from "next-intl/server";

import {
  getCropFactor,
  getDiagonalFieldOfView,
  getEquivalentAperture,
  getEquivalentFocalLength,
} from "./equivalence";
import { CAMERAS, LENSES, MOUNTS } from "./mock-data";
import type { Camera, Lens, SensorFormat } from "./types";

export type ComparisonItem =
  ({ type: "camera" } & Camera) | ({ type: "lens" } & Lens);

/**
 * Resolves slugs to their full camera/lens records, preserving the order of
 * `slugs` and silently dropping any that don't match a known item.
 */
export function resolveComparisonItems(slugs: string[]): ComparisonItem[] {
  const camerasBySlug = new Map(CAMERAS.map((camera) => [camera.slug, camera]));
  const lensesBySlug = new Map(LENSES.map((lens) => [lens.slug, lens]));

  return slugs
    .map((slug): ComparisonItem | undefined => {
      const camera = camerasBySlug.get(slug);
      if (camera) {
        return { type: "camera", ...camera };
      }

      const lens = lensesBySlug.get(slug);
      if (lens) {
        return { type: "lens", ...lens };
      }

      return undefined;
    })
    .filter((item): item is ComparisonItem => item !== undefined);
}

/**
 * A lens has no sensor of its own, so its 35mm-equivalent specs are derived
 * from the camera in the catalog that shares its mount (every mock lens is
 * paired 1:1 with a camera on the same mount).
 */
function getNativeCameraForLens(lens: Lens): Camera | undefined {
  return CAMERAS.find((camera) => camera.mount === lens.mount);
}

function i18nValue(key: string): string {
  return `i18n:${key}`;
}

/** Strips the `i18n:` marker `buildComparisonRows` uses for translatable
 * values, returning the bare message key, or `undefined` for plain text. */
export function getI18nKey(value: string): string | undefined {
  return value.startsWith("i18n:") ? value.slice("i18n:".length) : undefined;
}

export const SENSOR_FORMAT_KEYS: Record<SensorFormat, string> = {
  "full-frame": "ComparePage.sensorFormatFullFrame",
  "aps-c": "ComparePage.sensorFormatApsC",
  "micro-four-thirds": "ComparePage.sensorFormatMicroFourThirds",
  "medium-format": "ComparePage.sensorFormatMediumFormat",
};

export const SENSOR_FORMAT_BADGE_VARIANT: Record<
  SensorFormat,
  "default" | "secondary" | "outline"
> = {
  "full-frame": "default",
  "aps-c": "secondary",
  "micro-four-thirds": "outline",
  "medium-format": "outline",
};

function formatCropFactor(cropFactor: number): string {
  return `${cropFactor.toFixed(2)}×`;
}

export function formatAperture(aperture: number): string {
  return `ƒ/${aperture.toFixed(1)}`;
}

function formatFocalLength(mm: number): string {
  return `${Math.round(mm)}mm`;
}

export function formatFocalLengthRange(minMm: number, maxMm: number): string {
  return minMm === maxMm
    ? formatFocalLength(minMm)
    : `${Math.round(minMm)}–${Math.round(maxMm)}mm`;
}

function formatDegrees(deg: number): string {
  return `${deg.toFixed(1)}°`;
}

function formatDegreesRange(minDeg: number, maxDeg: number): string {
  return Math.abs(minDeg - maxDeg) < 0.05
    ? formatDegrees(minDeg)
    : `${minDeg.toFixed(1)}–${maxDeg.toFixed(1)}°`;
}

export interface ComparisonRow {
  id: string;
  labelKey: string;
  /** One value per item, in the same order as the resolved items. `null`
   * means the spec doesn't apply to that item (rendered as "—"). Values
   * prefixed with `i18n:` are message keys rather than display text. */
  values: Array<string | null>;
  /** True when every item has the same value for this row (including when
   * all are `null`, i.e. the row is inapplicable to every selected item). */
  isIdentical: boolean;
}

interface RowDefinition {
  id: string;
  labelKey: string;
  getValue: (item: ComparisonItem) => string | null;
}

const ROW_DEFINITIONS: RowDefinition[] = [
  {
    id: "type",
    labelKey: "ComparePage.rows.type",
    getValue: (item) =>
      i18nValue(
        item.type === "camera"
          ? "CompareSelector.typeCamera"
          : "CompareSelector.typeLens",
      ),
  },
  {
    id: "brand",
    labelKey: "ComparePage.rows.brand",
    getValue: (item) => item.brand,
  },
  {
    id: "model",
    labelKey: "ComparePage.rows.model",
    getValue: (item) => item.model,
  },
  {
    id: "mount",
    labelKey: "ComparePage.rows.mount",
    getValue: (item) => MOUNTS[item.mount].name,
  },
  {
    id: "releaseYear",
    labelKey: "ComparePage.rows.releaseYear",
    getValue: (item) => String(item.releaseYear),
  },
  {
    id: "sensorFormat",
    labelKey: "ComparePage.rows.sensorFormat",
    getValue: (item) =>
      item.type === "camera"
        ? i18nValue(SENSOR_FORMAT_KEYS[item.sensorFormat])
        : null,
  },
  {
    id: "sensorSize",
    labelKey: "ComparePage.rows.sensorSize",
    getValue: (item) =>
      item.type === "camera"
        ? `${item.sensor.widthMm.toFixed(1)} × ${item.sensor.heightMm.toFixed(1)} mm`
        : null,
  },
  {
    id: "cropFactor",
    labelKey: "ComparePage.rows.cropFactor",
    getValue: (item) => {
      const sensor =
        item.type === "camera"
          ? item.sensor
          : getNativeCameraForLens(item)?.sensor;
      return sensor ? formatCropFactor(getCropFactor(sensor)) : null;
    },
  },
  {
    id: "megapixels",
    labelKey: "ComparePage.rows.megapixels",
    getValue: (item) =>
      item.type === "camera" ? `${item.megapixels} MP` : null,
  },
  {
    id: "focalLength",
    labelKey: "ComparePage.rows.focalLength",
    getValue: (item) =>
      item.type === "lens"
        ? formatFocalLengthRange(item.minFocalLengthMm, item.maxFocalLengthMm)
        : null,
  },
  {
    id: "maxAperture",
    labelKey: "ComparePage.rows.maxAperture",
    getValue: (item) =>
      item.type === "lens" ? formatAperture(item.maxAperture) : null,
  },
  {
    id: "equivalentFocalLength",
    labelKey: "ComparePage.rows.equivalentFocalLength",
    getValue: (item) => {
      if (item.type !== "lens") {
        return null;
      }
      const nativeCamera = getNativeCameraForLens(item);
      if (!nativeCamera) {
        return null;
      }
      const cropFactor = getCropFactor(nativeCamera.sensor);
      return formatFocalLengthRange(
        getEquivalentFocalLength(item.minFocalLengthMm, cropFactor),
        getEquivalentFocalLength(item.maxFocalLengthMm, cropFactor),
      );
    },
  },
  {
    id: "equivalentAperture",
    labelKey: "ComparePage.rows.equivalentAperture",
    getValue: (item) => {
      if (item.type !== "lens") {
        return null;
      }
      const nativeCamera = getNativeCameraForLens(item);
      if (!nativeCamera) {
        return null;
      }
      const cropFactor = getCropFactor(nativeCamera.sensor);
      return formatAperture(
        getEquivalentAperture(item.maxAperture, cropFactor),
      );
    },
  },
  {
    id: "diagonalFieldOfView",
    labelKey: "ComparePage.rows.diagonalFieldOfView",
    getValue: (item) => {
      if (item.type !== "lens") {
        return null;
      }
      const nativeCamera = getNativeCameraForLens(item);
      if (!nativeCamera) {
        return null;
      }
      // Longer focal lengths narrow the field of view, so the widest angle
      // comes from the shortest focal length in the lens's range.
      const widestFov = getDiagonalFieldOfView(
        item.minFocalLengthMm,
        nativeCamera.sensor,
      );
      const narrowestFov = getDiagonalFieldOfView(
        item.maxFocalLengthMm,
        nativeCamera.sensor,
      );
      return formatDegreesRange(narrowestFov, widestFov);
    },
  },
];

export function buildComparisonRows(items: ComparisonItem[]): ComparisonRow[] {
  return ROW_DEFINITIONS.map((definition) => {
    const values = items.map((item) => definition.getValue(item));
    const isIdentical = values.every((value) => value === values[0]);

    return {
      id: definition.id,
      labelKey: definition.labelKey,
      values,
      isIdentical,
    };
  });
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/** Resolves a raw row value (plain text, an `i18n:`-marked key, or `null`)
 * to display text, translating as needed. Shared by the compare table,
 * product pages, and OG images so they all format values identically. */
export function formatRowValue(value: string | null, t: Translator): string {
  if (value === null) {
    return t("ComparePage.notApplicable");
  }
  const key = getI18nKey(value);
  return key ? t(key) : value;
}

/** Looks up one item's formatted value for a given row id. `itemIndex`
 * matches the position of the item in the array passed to
 * `buildComparisonRows` (typically `0` for single-item product pages). */
export function getFormattedRowValue(
  rows: ComparisonRow[],
  rowId: string,
  itemIndex: number,
  t: Translator,
): string {
  const row = rows.find((r) => r.id === rowId);
  return formatRowValue(row?.values[itemIndex] ?? null, t);
}
