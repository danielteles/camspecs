"""Wikidata SPARQL extractor for camera and lens specifications.

Property/class IDs below were verified empirically against the live endpoint
(not guessed) — see the comments next to each for what would go wrong
otherwise. Run as a CLI with `python -m extractors.wikidata` from
`scripts/scraper/` (venv active).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import re
from typing import Any

import httpx
from pydantic import ValidationError

from models import CameraSpecs, LensSpecs

logger = logging.getLogger(__name__)

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "camspecs-scraper/0.1 (local dev; contact: work@dteles.dev)"
REQUEST_TIMEOUT_S = 30.0
MAX_ATTEMPTS = 3

# Individual camera/lens model items are instance-of these, not the generic
# "camera" (Q62927) / "camera lens" (Q192234) concept classes.
CAMERA_MODEL_QID = "Q20741022"  # "digital camera model"
LENS_MODEL_QID = "Q109672300"  # "lens model"

# P2935 ("connector") is a generic "physical connectors this device has"
# property — on real camera items it also picks up HDMI/USB ports, not just
# the lens mount. An earlier version of this query constrained it to the
# generic "lens mount" (Q205722) subclass tree via P279*, which filtered out
# non-mount connectors but let through every lens mount ever made, including
# legacy DSLR mounts (Canon EF, etc.) the frontend's MountId type doesn't
# support. Enumerating the exact mounts we support instead fixes both
# problems at once: no false positives, and every row is guaranteed usable.
# QIDs verified empirically against the live endpoint (not guessed).
#
# This mirrorless-only set is a deliberate, formalized scope decision, not
# a gap — see the repo README's "Architecture: supported mounts" section.
MOUNT_QIDS = {
    "canon-rf": "Q56487870",  # Canon RF lens mount
    "nikon-z": "Q56240413",  # Nikon Z-mount
    "sony-e": "Q209536",  # Sony E-mount
    "fujifilm-x": "Q209708",  # Fujifilm X-mount
    "fujifilm-g": "Q65553416",  # Fujifilm G-mount (medium format)
    "micro-four-thirds": "Q1366492",  # Micro Four Thirds system
    "l-mount": "Q30242162",  # L-Mount
}
# The reverse lookup camera/lens bindings use to resolve a mount QID to our
# canonical MountId slug directly, instead of running Wikidata's English
# label ("Canon RF lens mount", "L-Mount", "Micro Four Thirds system", ...)
# through the generic normalize_mount() regex used elsewhere in the
# pipeline. That regex only strips the word "mount"; verified live that it
# mangles these specific labels ("Canon RF lens mount" -> "canon-rf-lens",
# "L-Mount" -> "l", "Micro Four Thirds system" -> "micro-four-thirds-system"
# — none matching the app's MountId values). Since the query already
# constrains ?mount to exactly these QIDs, resolving by QID is both exact
# and immune to future label wording changes.
_QID_TO_MOUNT_ID = {qid: mount_id for mount_id, qid in MOUNT_QIDS.items()}

_UNRESOLVED_LABEL = re.compile(r"^Q\d+$")


def _mount_values_clause() -> str:
    return " ".join(f"wd:{qid}" for qid in MOUNT_QIDS.values())


def build_camera_sparql(limit: int) -> str:
    # Ordering by release date (falling back to announce date) so the LIMIT
    # cutoff keeps the newest cameras rather than an arbitrary slice —
    # otherwise Wikidata's query planner tends to surface old, low-QID items
    # first (early-2000s DSLRs), crowding out the current mirrorless bodies
    # this site actually covers.
    #
    # P2935|P527 (property path alternation): verified live that most GFX
    # (Fujifilm G-mount) camera items don't use P2935 ("connector") for
    # their mount at all — of 5 known GFX bodies checked, only 2 (GFX100S,
    # GFX100 II) have mount data on Wikidata at all, and both record it via
    # P527 ("has part(s)") instead. Every other supported mount is tagged
    # via P2935 consistently (spot-checked against the full live result
    # set), so this alternation is additive — it doesn't change which items
    # match for Canon/Nikon/Sony/Fujifilm X/MFT/L-mount, only picks up the
    # P527-tagged GFX items P2935 alone would miss. The other 3 known GFX
    # bodies (50S, 100, 100S II) have no mount property under either name —
    # a genuine Wikidata data gap, not something a broader property path
    # can recover.
    return f"""
SELECT ?item ?itemLabel ?manufacturerLabel ?mount ?mountLabel ?mass ?pubDate ?announceDate WHERE {{
  ?item wdt:P31 wd:{CAMERA_MODEL_QID};
        wdt:P176 ?manufacturer;
        (wdt:P2935|wdt:P527) ?mount.
  VALUES ?mount {{ {_mount_values_clause()} }}
  OPTIONAL {{ ?item wdt:P2067 ?mass. }}
  OPTIONAL {{ ?item wdt:P577 ?pubDate. }}
  OPTIONAL {{ ?item wdt:P6949 ?announceDate. }}
  BIND(COALESCE(?pubDate, ?announceDate) AS ?date)
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
ORDER BY DESC(?date)
LIMIT {limit}
""".strip()


def build_lens_sparql(limit: int) -> str:
    # Focal length (P2151) and aperture (P7863) are multi-valued for zoom
    # lenses (e.g. wide/tele focal length, wide-open/stopped-down aperture).
    # A subquery aggregates MIN/MAX per item *before* joining labels, since
    # combining SERVICE wikibase:label with GROUP BY in a single scope
    # doesn't reliably group the label variables. The subquery has no LIMIT
    # of its own — mount-filtering and recency-ordering happen in the outer
    # scope, so a limit here would truncate candidates before either applies
    # (verified live: the unlimited aggregation still completes in ~1s).
    return f"""
SELECT ?item ?itemLabel ?manufacturerLabel ?mount ?mountLabel
       ?minFocalLength ?maxFocalLength ?minAperture ?maxAperture
       ?mass ?pubDate ?announceDate WHERE {{
  {{
    SELECT ?item (MIN(?fl) AS ?minFocalLength) (MAX(?fl) AS ?maxFocalLength)
                 (MIN(?ap) AS ?minAperture) (MAX(?ap) AS ?maxAperture)
    WHERE {{
      ?item wdt:P31 wd:{LENS_MODEL_QID};
            wdt:P2151 ?fl;
            wdt:P7863 ?ap.
    }}
    GROUP BY ?item
  }}
  ?item wdt:P176 ?manufacturer;
        wdt:P2935 ?mount.
  VALUES ?mount {{ {_mount_values_clause()} }}
  OPTIONAL {{ ?item wdt:P2067 ?mass. }}
  OPTIONAL {{ ?item wdt:P577 ?pubDate. }}
  OPTIONAL {{ ?item wdt:P6949 ?announceDate. }}
  BIND(COALESCE(?pubDate, ?announceDate) AS ?date)
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
ORDER BY DESC(?date)
LIMIT {limit}
""".strip()


async def _execute_sparql(client: httpx.AsyncClient, query: str) -> dict[str, Any]:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = await client.post(
                SPARQL_ENDPOINT,
                data={"query": query},
                headers={"Accept": "application/sparql-results+json"},
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPStatusError, httpx.TransportError) as exc:
            last_exc = exc
            wait_s = 2**attempt
            logger.warning(
                "SPARQL request failed (attempt %d/%d): %s — retrying in %ds",
                attempt,
                MAX_ATTEMPTS,
                exc,
                wait_s,
            )
            if attempt < MAX_ATTEMPTS:
                await asyncio.sleep(wait_s)
    raise RuntimeError(f"SPARQL request failed after {MAX_ATTEMPTS} attempts") from last_exc


def _binding_value(binding: dict[str, Any], key: str) -> str | None:
    return binding.get(key, {}).get("value")


def _extract_qid(item_uri: str) -> str:
    return item_uri.rsplit("/", 1)[-1]


def _is_unresolved_label(value: str) -> bool:
    # The label service falls back to the raw QID when no English label
    # exists; treat that as missing data rather than a usable brand/model.
    return bool(_UNRESOLVED_LABEL.fullmatch(value))


# Wikidata's manufacturerLabel resolves to whatever the *manufacturer
# item's* current best English label is — often the parent corporate
# entity's full legal/official name, not the consumer brand printed on the
# product itself. Verified live: real pipeline output has `brand="Sony
# Group"` on a lens whose own item label is "Sony E 11mm F1.8", "Canon
# Inc." on cameras labeled "Canon EOS ...", "Fujifilm Corporation" on
# "Fujifilm X-..." items, and "Panasonic Holdings Corporation" on
# "Panasonic Lumix ..." items. `_strip_brand_prefix` only strips an
# exact-prefix match, so an unnormalized corporate name never matches the
# product label's own brand prefix and both end up concatenated in the
# final title (e.g. "Sony Group" + "Sony E 11mm F1.8", never stripped).
#
# Every alias below is a verified real value from a live pipeline run, not
# a guess — mapped to the exact brand word each manufacturer's own product
# labels are prefixed with, which is what makes `_strip_brand_prefix` work
# correctly afterward. "Nikon" needs no entry: Wikidata's label for it
# already matches Nikon's own product-label prefix.
_MANUFACTURER_LABEL_ALIASES: dict[str, str] = {
    "sony group": "Sony",
    "canon inc.": "Canon",
    "fujifilm corporation": "Fujifilm",
    "panasonic holdings corporation": "Panasonic",
}

# Fallback for a corporate label not already covered by the verified alias
# map above (e.g. a manufacturer outside our current live data, or Wikidata
# rewording an existing one) — strips common corporate-entity suffixes so
# an unrecognized label still degrades to something reasonable instead of
# reproducing the double-branding bug outright. Ordered longest-first
# within each alternation group so a compound suffix (e.g. "Holdings
# Corporation") isn't left partially stripped by a shorter alternative
# matching first.
_CORPORATE_SUFFIX_PATTERN = re.compile(
    r"\s+(holdings corporation|corporation|group|co\.,?\s*ltd\.?|ltd\.?|inc\.?)\s*$",
    re.IGNORECASE,
)


def _normalize_manufacturer_label(label: str) -> str:
    """Resolves a raw Wikidata manufacturerLabel to a product-facing brand name.

    Tries the verified alias map first (exact, known-correct); falls back
    to stripping a trailing corporate-entity suffix for anything else,
    rather than leaving an unrecognized corporate name untouched.
    """
    normalized = _MANUFACTURER_LABEL_ALIASES.get(label.strip().lower())
    if normalized:
        return normalized
    stripped = _CORPORATE_SUFFIX_PATTERN.sub("", label).strip()
    return stripped or label


def _strip_brand_prefix(label: str, brand: str) -> str:
    prefix = f"{brand} "
    if label.lower().startswith(prefix.lower()):
        return label[len(prefix) :]
    return label


def _parse_release_year(binding: dict[str, Any]) -> int | None:
    for key in ("pubDate", "announceDate"):
        value = _binding_value(binding, key)
        if value:
            try:
                return int(value[:4])
            except ValueError:
                continue
    return None


def _resolve_mount_id(binding: dict[str, Any]) -> str | None:
    """Resolves a binding's ?mount QID to our canonical MountId slug.

    The VALUES clause in both SPARQL queries constrains ?mount to exactly
    the QIDs in MOUNT_QIDS, so this should never miss — but falls back to
    None (dropping the record) rather than a fragile label-based guess if a
    future query change lets an unmapped QID through.
    """
    mount_value = _binding_value(binding, "mount")
    if not mount_value:
        return None
    return _QID_TO_MOUNT_ID.get(_extract_qid(mount_value))


def _map_camera_binding(binding: dict[str, Any]) -> dict[str, Any] | None:
    model_label = _binding_value(binding, "itemLabel")
    brand = _binding_value(binding, "manufacturerLabel")
    mount = _resolve_mount_id(binding)
    if not model_label or not brand or not mount:
        return None
    if any(_is_unresolved_label(v) for v in (model_label, brand)):
        return None
    brand = _normalize_manufacturer_label(brand)

    qid = _extract_qid(binding["item"]["value"])
    return {
        "brand": brand,
        "model": _strip_brand_prefix(model_label, brand),
        "mount": mount,
        # Wikidata has no populated property for sensor format on camera
        # model items (checked: image sensor size/format properties exist
        # but are essentially unused here) — left for the manufacturer
        # scraper / merge step to fill in.
        "sensor_format": "other",
        "weight_g": _binding_value(binding, "mass"),
        "release_year": _parse_release_year(binding),
        "source": "wikidata",
        "source_url": f"https://www.wikidata.org/wiki/{qid}",
    }


def _map_lens_binding(binding: dict[str, Any]) -> dict[str, Any] | None:
    model_label = _binding_value(binding, "itemLabel")
    brand = _binding_value(binding, "manufacturerLabel")
    mount = _resolve_mount_id(binding)
    min_fl = _binding_value(binding, "minFocalLength")
    max_fl = _binding_value(binding, "maxFocalLength")
    min_ap = _binding_value(binding, "minAperture")
    max_ap = _binding_value(binding, "maxAperture")
    if not model_label or not brand or not mount:
        return None
    if any(_is_unresolved_label(v) for v in (model_label, brand)):
        return None
    if None in (min_fl, max_fl, min_ap, max_ap):
        return None
    brand = _normalize_manufacturer_label(brand)

    qid = _extract_qid(binding["item"]["value"])
    return {
        "brand": brand,
        "model": _strip_brand_prefix(model_label, brand),
        "mount": mount,
        "min_focal_length_mm": min_fl,
        "max_focal_length_mm": max_fl,
        "min_aperture": min_ap,
        "max_aperture": max_ap,
        "weight_g": _binding_value(binding, "mass"),
        "release_year": _parse_release_year(binding),
        "source": "wikidata",
        "source_url": f"https://www.wikidata.org/wiki/{qid}",
    }


async def fetch_cameras(client: httpx.AsyncClient, limit: int = 25) -> list[CameraSpecs]:
    payload = await _execute_sparql(client, build_camera_sparql(limit))
    bindings = payload["results"]["bindings"]

    results: list[CameraSpecs] = []
    seen_qids: set[str] = set()
    skipped = 0
    for binding in bindings:
        qid = _extract_qid(binding["item"]["value"])
        if qid in seen_qids:
            continue
        seen_qids.add(qid)

        raw = _map_camera_binding(binding)
        if raw is None:
            skipped += 1
            continue
        try:
            results.append(CameraSpecs.model_validate(raw))
        except ValidationError as exc:
            skipped += 1
            logger.debug("Skipping camera %s: %s", qid, exc)

    logger.info("Wikidata cameras: %d validated, %d skipped", len(results), skipped)
    return results


async def fetch_lenses(client: httpx.AsyncClient, limit: int = 25) -> list[LensSpecs]:
    payload = await _execute_sparql(client, build_lens_sparql(limit))
    bindings = payload["results"]["bindings"]

    results: list[LensSpecs] = []
    seen_qids: set[str] = set()
    skipped = 0
    for binding in bindings:
        qid = _extract_qid(binding["item"]["value"])
        if qid in seen_qids:
            continue
        seen_qids.add(qid)

        raw = _map_lens_binding(binding)
        if raw is None:
            skipped += 1
            continue
        try:
            results.append(LensSpecs.model_validate(raw))
        except ValidationError as exc:
            skipped += 1
            logger.debug("Skipping lens %s: %s", qid, exc)

    logger.info("Wikidata lenses: %d validated, %d skipped", len(results), skipped)
    return results


async def fetch_release_year(client: httpx.AsyncClient, qid: str) -> int | None:
    """Looks up a single Wikidata item's release year directly by QID.

    Manufacturer-scraped cameras sometimes lack a release date on their own
    product page (verified live: Nikon USA's "Tech Specs" tab has none) but
    the item's Wikidata entry has one — the general camera crawl above can't
    reach it via the merge step, though, because some recent camera items
    (e.g. Nikon Z6III, Z50II — checked directly) simply have no P2935 (lens
    mount) statement on Wikidata yet, so they fail the required mount join
    build_camera_sparql relies on. This bypasses that join entirely: no
    mount needed, just the one fact this call exists to backfill.
    """
    query = f"""
SELECT ?pubDate ?announceDate WHERE {{
  OPTIONAL {{ wd:{qid} wdt:P577 ?pubDate. }}
  OPTIONAL {{ wd:{qid} wdt:P6949 ?announceDate. }}
}}
""".strip()
    payload = await _execute_sparql(client, query)
    bindings = payload["results"]["bindings"]
    if not bindings:
        return None
    return _parse_release_year(bindings[0])


async def _run(entity_type: str, limit: int) -> None:
    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT_S
    ) as client:
        if entity_type in ("camera", "both"):
            cameras = await fetch_cameras(client, limit)
            print(f"\n=== Cameras ({len(cameras)}) ===")
            for camera in cameras:
                print(camera.model_dump_json(indent=2))

        if entity_type in ("lens", "both"):
            lenses = await fetch_lenses(client, limit)
            print(f"\n=== Lenses ({len(lenses)}) ===")
            for lens in lenses:
                print(lens.model_dump_json(indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch camera/lens specs from Wikidata via SPARQL.")
    parser.add_argument("--type", choices=["camera", "lens", "both"], default="both")
    parser.add_argument("--limit", type=int, default=25, help="Max entities to fetch per type")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(_run(args.type, args.limit))


if __name__ == "__main__":
    main()
