import type { Mount, MountId } from "./types";

/**
 * Static lens-mount reference data (name, flange distance) — not scraped
 * equipment, so it lives apart from the database-backed camera/lens catalog.
 */
export const MOUNTS: Record<MountId, Mount> = {
  "canon-rf": { id: "canon-rf", name: "Canon RF", flangeDistanceMm: 20.0 },
  "nikon-z": { id: "nikon-z", name: "Nikon Z", flangeDistanceMm: 16.0 },
  "sony-e": { id: "sony-e", name: "Sony E", flangeDistanceMm: 18.0 },
  "fujifilm-x": {
    id: "fujifilm-x",
    name: "Fujifilm X",
    flangeDistanceMm: 17.7,
  },
  "fujifilm-g": {
    id: "fujifilm-g",
    name: "Fujifilm G",
    flangeDistanceMm: 26.7,
  },
  "micro-four-thirds": {
    id: "micro-four-thirds",
    name: "Micro Four Thirds",
    flangeDistanceMm: 19.25,
  },
  "l-mount": { id: "l-mount", name: "L-Mount", flangeDistanceMm: 20.0 },
  // 27.95mm per Wikidata's Leica M mount item (Q313909, property P2043
  // "length"), cross-checked against its P2386 "diameter" of 44mm, which
  // matches Leica's well-documented 44mm M-mount bayonet spec.
  "leica-m": { id: "leica-m", name: "Leica M", flangeDistanceMm: 27.95 },
};
