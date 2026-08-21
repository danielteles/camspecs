import type { Camera, Lens, Mount, MountId } from "./types";

export const MOUNTS: Record<MountId, Mount> = {
  "canon-rf": { id: "canon-rf", name: "Canon RF", flangeDistanceMm: 20.0 },
  "nikon-z": { id: "nikon-z", name: "Nikon Z", flangeDistanceMm: 16.0 },
  "sony-e": { id: "sony-e", name: "Sony E", flangeDistanceMm: 18.0 },
  "fujifilm-x": {
    id: "fujifilm-x",
    name: "Fujifilm X",
    flangeDistanceMm: 17.7,
  },
  "micro-four-thirds": {
    id: "micro-four-thirds",
    name: "Micro Four Thirds",
    flangeDistanceMm: 19.25,
  },
  "l-mount": { id: "l-mount", name: "L-Mount", flangeDistanceMm: 20.0 },
};

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
    releaseYear: 2019,
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
    releaseYear: 2015,
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
    releaseYear: 2014,
  },
];
