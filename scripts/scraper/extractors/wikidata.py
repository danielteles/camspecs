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
# the lens mount. Constraining the value to the "lens mount" (Q205722)
# subclass tree via P279* is what filters those false positives out.
LENS_MOUNT_CLASS_QID = "Q205722"

_UNRESOLVED_LABEL = re.compile(r"^Q\d+$")


def build_camera_sparql(limit: int) -> str:
    return f"""
SELECT ?item ?itemLabel ?manufacturerLabel ?mountLabel ?mass ?pubDate ?announceDate WHERE {{
  ?item wdt:P31 wd:{CAMERA_MODEL_QID};
        wdt:P176 ?manufacturer;
        wdt:P2935 ?mount.
  ?mount wdt:P279* wd:{LENS_MOUNT_CLASS_QID}.
  OPTIONAL {{ ?item wdt:P2067 ?mass. }}
  OPTIONAL {{ ?item wdt:P577 ?pubDate. }}
  OPTIONAL {{ ?item wdt:P6949 ?announceDate. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT {limit}
""".strip()


def build_lens_sparql(limit: int) -> str:
    # Focal length (P2151) and aperture (P7863) are multi-valued for zoom
    # lenses (e.g. wide/tele focal length, wide-open/stopped-down aperture).
    # A subquery aggregates MIN/MAX per item *before* joining labels, since
    # combining SERVICE wikibase:label with GROUP BY in a single scope
    # doesn't reliably group the label variables.
    return f"""
SELECT ?item ?itemLabel ?manufacturerLabel ?mountLabel
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
    LIMIT {limit}
  }}
  ?item wdt:P176 ?manufacturer;
        wdt:P2935 ?mount.
  ?mount wdt:P279* wd:{LENS_MOUNT_CLASS_QID}.
  OPTIONAL {{ ?item wdt:P2067 ?mass. }}
  OPTIONAL {{ ?item wdt:P577 ?pubDate. }}
  OPTIONAL {{ ?item wdt:P6949 ?announceDate. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
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


def _map_camera_binding(binding: dict[str, Any]) -> dict[str, Any] | None:
    model_label = _binding_value(binding, "itemLabel")
    brand = _binding_value(binding, "manufacturerLabel")
    mount = _binding_value(binding, "mountLabel")
    if not model_label or not brand or not mount:
        return None
    if any(_is_unresolved_label(v) for v in (model_label, brand, mount)):
        return None

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
    mount = _binding_value(binding, "mountLabel")
    min_fl = _binding_value(binding, "minFocalLength")
    max_fl = _binding_value(binding, "maxFocalLength")
    min_ap = _binding_value(binding, "minAperture")
    max_ap = _binding_value(binding, "maxAperture")
    if not model_label or not brand or not mount:
        return None
    if any(_is_unresolved_label(v) for v in (model_label, brand, mount)):
        return None
    if None in (min_fl, max_fl, min_ap, max_ap):
        return None

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
