"""Multi-source merger for CameraSpecs / LensSpecs records.

Manufacturer-scraped records are treated as authoritative. Versus.com backs
them up next, then Wikidata: each lower-priority source backfills whatever
fields the higher-priority ones left null, and is itself overridden wherever
a higher-priority source has a value. Works generically on either model type
since both are validated Pydantic models with a `brand`/`model`/`mount`/
`source` shape.
"""

from __future__ import annotations

import re
from typing import TypeVar

from pydantic import BaseModel

from extractors.curated_fallbacks import (
    LENS_KIT_RELEASE_YEARS,
    MOUNT_SENSOR_FORMATS,
    VERSUS_CAMERA_RELEASE_YEARS,
    VERSUS_SLUG_MOUNT_OVERRIDES,
)
from models.camera import CameraSpecs
from models.enums import SensorFormat
from models.lens import LensSpecs

T = TypeVar("T", bound=BaseModel)

# Fields that identify *which* source(s) produced a record rather than
# describing the item itself — these are handled separately from the
# generic backfill loop instead of being overwritten by a lower-priority
# source.
_PROVENANCE_FIELDS = frozenset({"source", "source_url", "scraped_at", "slug"})

_NON_ALNUM = re.compile(r"[^a-z0-9]")


# Non-manufacturer sources ranked lower-wins-first, per the priority
# hierarchy: Official Manufacturer > Versus.com > Wikidata. Anything not
# listed here (i.e. not yet a known source) sorts after all of these rather
# than silently outranking Wikidata.
_SOURCE_PRIORITY = {
    "versus": 1,
    "wikidata": 2,
}


def _source_priority(source: str) -> int:
    # Lower sorts first = wins conflicts. Manufacturer-prefixed sources
    # (e.g. "manufacturer:nikon") outrank everything else.
    if source.startswith("manufacturer:"):
        return 0
    return _SOURCE_PRIORITY.get(source, len(_SOURCE_PRIORITY) + 1)


def merge_key(brand: str, model: str, mount: str) -> str:
    """Build a loose dedup key that survives cosmetic formatting differences.

    Different sources format the same product differently — Nikon's own
    page says "Z6III" while Wikidata's label service says "Z6 III" — so an
    exact slug match would fail to recognize them as the same item. Mount is
    kept as its own segment (already normalized upstream by each model's
    validators) since brand+model alone can collide across mount variants.
    """
    normalized = _NON_ALNUM.sub("", f"{brand}{model}".lower())
    return f"{mount}:{normalized}"


def _is_empty(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, (list, dict, str)) and not value:
        return True
    return False


def _merge_group(group: list[T]) -> T:
    ordered = sorted(group, key=lambda record: _source_priority(record.source))
    model_cls = type(ordered[0])
    merged = ordered[0].model_dump()
    contributing_sources = [ordered[0].source]

    for record in ordered[1:]:
        data = record.model_dump()
        backfilled = False
        for field, value in data.items():
            if field in _PROVENANCE_FIELDS:
                continue
            if _is_empty(merged.get(field)) and not _is_empty(value):
                merged[field] = value
                backfilled = True
        if backfilled:
            contributing_sources.append(record.source)

    # Record every source that actually contributed a field, not just the
    # primary one, so the merged record's provenance stays traceable without
    # needing a new schema field.
    merged["source"] = "+".join(dict.fromkeys(contributing_sources))
    return model_cls.model_validate(merged)


def merge_records(records: list[T]) -> list[T]:
    """Deduplicate and merge same-item records from multiple sources.

    Records are grouped by `merge_key`; within a group the highest-priority
    source's fields win on conflict, and any field left null there is
    backfilled from the next source in priority order that has a value.
    Groups of size one pass through unchanged (only their `source` field is
    normalized, which is a no-op for single-source records).
    """
    groups: dict[str, list[T]] = {}
    for record in records:
        key = merge_key(record.brand, record.model, record.mount)
        groups.setdefault(key, []).append(record)

    return [_merge_group(group) for group in groups.values()]


def drop_unmergeable_wikidata_cameras(cameras: list[CameraSpecs]) -> list[CameraSpecs]:
    """Drop merged camera records that only Wikidata ever contributed to.

    Wikidata has no populated sensor-format property for camera items (see
    extractors/wikidata.py's `_map_camera_binding`) — every Wikidata camera
    record is created with `sensor_format="other"`. That value only
    survives into the merged record when no manufacturer/Versus source also
    covers the same camera: `_is_empty()` treats "other" as a real,
    non-empty value, so a higher-priority source's real format always wins
    the merge instead of being backfilled over. A merged record with
    `sensor_format=="other"` and no manufacturer/Versus contribution is
    therefore never going to resolve a real sensor format — no fallback
    (transformers/sensor_fallback.py) or frontend rule (see
    lib/services/equipment.ts's `toCamera`) can save it — so keeping it
    around just means upserting a row nobody will ever see. Checking
    `source == "wikidata"` rather than just the format alone avoids
    dropping a genuine manufacturer/Versus record that happens to land on
    "other" itself (a real, separately-diagnosable scraping gap, not this
    problem).
    """
    return [
        camera
        for camera in cameras
        if not (camera.sensor_format == SensorFormat.OTHER and camera.source == "wikidata")
    ]


def apply_curated_sensor_format_overrides(cameras: list[CameraSpecs]) -> list[CameraSpecs]:
    """Backfill sensor_format for mounts where it's a settled physical fact.

    Must run before `drop_unmergeable_wikidata_cameras` in the pipeline —
    see `extractors.curated_fallbacks.MOUNT_SENSOR_FORMATS` for which three
    mounts qualify (and why the rest deliberately don't) — otherwise every
    Wikidata-only camera this could save is already gone by the time it
    runs. Only touches records still stuck at "other"; a real format from a
    higher-priority source is left alone.
    """
    for camera in cameras:
        if camera.sensor_format != SensorFormat.OTHER:
            continue
        override = MOUNT_SENSOR_FORMATS.get(camera.mount)
        if override is not None:
            camera.sensor_format = override
    return cameras


def apply_curated_camera_release_years(cameras: list[CameraSpecs]) -> list[CameraSpecs]:
    """Backfill release_year for the Versus camera slugs with a confirmed double-checked gap.

    See `extractors.curated_fallbacks.VERSUS_CAMERA_RELEASE_YEARS` for which
    slugs and why: each was checked live against both Versus's own spec
    table and its Wikidata QID and found to carry no date anywhere, so the
    normal cross-source backfill in `merge_records` never has anything to
    pull from. Matched by the Versus slug embedded in `source_url`, same as
    `apply_curated_lens_release_years` below.
    """
    for camera in cameras:
        if camera.release_year is not None:
            continue
        slug = _versus_slug_from_source_url(camera.source_url)
        if slug is None:
            continue
        override = VERSUS_CAMERA_RELEASE_YEARS.get(slug)
        if override is not None:
            camera.release_year = override
    return cameras


def _versus_slug_from_source_url(source_url: object) -> str | None:
    """Recover the Versus product slug from a record's `source_url`.

    Works for both a plain camera page (`.../en/{slug}`) and a "camera +
    lens" kit page (`.../en/{camera-slug}-{lens-slug}`) — either way the
    slug is just the URL's last path segment (see `extractors/versus.py`'s
    `BASE_URL`).
    """
    if source_url is None:
        return None
    return str(source_url).rstrip("/").rsplit("/", 1)[-1]


def apply_curated_mount_overrides(cameras: list[CameraSpecs]) -> list[CameraSpecs]:
    """Backfill `mount` for the Versus slugs with a confirmed per-page scraping gap.

    See `extractors.curated_fallbacks.VERSUS_SLUG_MOUNT_OVERRIDES` for which
    slugs and why: each is a real interchangeable-lens camera whose Versus
    page omits the `lens-mount` spec row outright, so nothing upstream of
    this ever has a value to backfill from. Must run before `merge_records`
    (unlike the sensor-format/release-year overrides below, which run after)
    — `merge_key` groups records by mount, so a still-null mount here would
    both dodge deduplication against a same-camera Wikidata record and get
    dropped by `main.py`'s `_drop_unsupported_mounts` before this function
    ever got a chance to run on the merged result.
    """
    for camera in cameras:
        if camera.mount is not None:
            continue
        slug = _versus_slug_from_source_url(camera.source_url)
        if slug is None:
            continue
        override = VERSUS_SLUG_MOUNT_OVERRIDES.get(slug)
        if override is not None:
            camera.mount = override
    return cameras


def apply_curated_lens_release_years(lenses: list[LensSpecs]) -> list[LensSpecs]:
    """Backfill release_year for the lens-kit slugs with a confirmed Wikidata gap.

    See `extractors.curated_fallbacks.LENS_KIT_RELEASE_YEARS` for which
    slugs and why: each was checked live against its own Wikidata QID and
    found to carry no date statement at all, so the normal cross-source
    backfill in `merge_records` never has anything to pull from. Matched by
    the Versus kit slug embedded in `source_url` (see `extractors/versus.py`'s
    `BASE_URL`) rather than the record's own auto-generated `slug`, since
    that slug is derived from scraped display text and isn't a stable lookup
    key the way the kit slug — already hardcoded and live-verified in
    `main.py`'s `DEFAULT_VERSUS_LENS_SLUGS` — is. `source_url` survives
    `merge_records` unchanged (it's a provenance field, never backfilled)
    for every lens this dictionary targets, since Versus outranks Wikidata
    and is always the higher-priority source for these kit-derived records.
    """
    for lens in lenses:
        if lens.release_year is not None:
            continue
        slug = _versus_slug_from_source_url(lens.source_url)
        if slug is None:
            continue
        override = LENS_KIT_RELEASE_YEARS.get(slug)
        if override is not None:
            lens.release_year = override
    return lenses
