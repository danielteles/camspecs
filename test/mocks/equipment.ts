import type { Camera, Lens } from "@/lib/types";

/**
 * Deterministic camera/lens fixtures for unit tests. Formerly lib/mock-data.ts,
 * which the app used as a runtime fallback before Postgres was wired up;
 * kept here (test-only) since compare-data/search/equivalence tests rely on
 * these exact brands, slugs, and sensor dimensions for their assertions.
 */
export const CAMERAS: Camera[] = [
  {
    slug: "sony-a7-iv",
    brand: "Sony",
    model: "Alpha 7 IV",
    mount: "sony-e",
    sensorFormat: "full-frame",
    sensor: { widthMm: 35.6, heightMm: 23.8 },
    megapixels: 33,
    releaseYear: 2021,
    weightG: 658,
    updatedAt: new Date("2026-08-20T12:00:00Z"),
  },
  {
    slug: "fujifilm-x-t5",
    brand: "Fujifilm",
    model: "X-T5",
    mount: "fujifilm-x",
    sensorFormat: "aps-c",
    sensor: { widthMm: 23.5, heightMm: 15.6 },
    megapixels: 40.2,
    releaseYear: 2022,
    weightG: 557,
    updatedAt: new Date("2026-08-18T09:30:00Z"),
  },
  {
    slug: "om-system-om-1",
    brand: "OM System",
    model: "OM-1",
    mount: "micro-four-thirds",
    sensorFormat: "micro-four-thirds",
    sensor: { widthMm: 17.4, heightMm: 13.0 },
    megapixels: 20.4,
    releaseYear: 2022,
    weightG: 599,
    updatedAt: new Date("2026-08-15T18:45:00Z"),
  },
];

export const LENSES: Lens[] = [
  {
    slug: "sony-fe-50mm-f1-8",
    brand: "Sony",
    model: "FE 50mm F1.8",
    mount: "sony-e",
    minFocalLengthMm: 50,
    maxFocalLengthMm: 50,
    maxAperture: 1.8,
    minAperture: 22,
    weightG: 186,
    isPrime: true,
    releaseYear: 2019,
    updatedAt: new Date("2026-08-19T08:15:00Z"),
  },
  {
    slug: "fujifilm-xf-16-55mm-f2-8",
    brand: "Fujifilm",
    model: "XF 16-55mm F2.8 R LM WR",
    mount: "fujifilm-x",
    minFocalLengthMm: 16,
    maxFocalLengthMm: 55,
    maxAperture: 2.8,
    minAperture: 22,
    weightG: 655,
    isPrime: false,
    releaseYear: 2015,
    updatedAt: new Date("2026-08-17T14:00:00Z"),
  },
  {
    slug: "olympus-mzuiko-25mm-f1-8",
    brand: "Olympus",
    model: "M.Zuiko Digital 25mm F1.8",
    mount: "micro-four-thirds",
    minFocalLengthMm: 25,
    maxFocalLengthMm: 25,
    maxAperture: 1.8,
    minAperture: 22,
    weightG: 137,
    isPrime: true,
    releaseYear: 2014,
    updatedAt: new Date("2026-08-10T11:20:00Z"),
  },
];
