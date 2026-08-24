"""Upsert (insert-or-update-nulls-only) operations for cameras and lenses."""

from __future__ import annotations

import logging

from sqlalchemy import Table, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import CameraRecord, LensRecord
from models import CameraSpecs, LensSpecs

logger = logging.getLogger(__name__)

# These describe *when/where the data came from*, not the specs themselves —
# they're always refreshed to reflect the most recent pipeline run, even if
# the run's merged record didn't change any content field.
_PROVENANCE_COLUMNS = frozenset({"source", "source_url", "scraped_at"})
# Never touched on conflict: slug is the identity, created_at is set once.
_IMMUTABLE_COLUMNS = frozenset({"slug", "created_at"})


def _camera_to_row(camera: CameraSpecs) -> dict:
    return {
        "slug": camera.slug,
        "brand": camera.brand,
        "model": camera.model,
        "mount": camera.mount,
        "sensor_format": camera.sensor_format.value,
        "sensor_width_mm": camera.sensor.width_mm if camera.sensor else None,
        "sensor_height_mm": camera.sensor.height_mm if camera.sensor else None,
        "megapixels": camera.megapixels,
        "release_year": camera.release_year,
        "weight_g": camera.weight_g,
        "crop_factor": camera.crop_factor,
        "video_formats": camera.video_formats,
        "source": camera.source,
        "source_url": str(camera.source_url) if camera.source_url else None,
        "scraped_at": camera.scraped_at,
    }


def _lens_to_row(lens: LensSpecs) -> dict:
    return {
        "slug": lens.slug,
        "brand": lens.brand,
        "model": lens.model,
        "mount": lens.mount,
        "min_focal_length_mm": lens.min_focal_length_mm,
        "max_focal_length_mm": lens.max_focal_length_mm,
        "min_aperture": lens.min_aperture,
        "max_aperture": lens.max_aperture,
        "weight_g": lens.weight_g,
        "is_prime": lens.is_prime,
        "release_year": lens.release_year,
        "source": lens.source,
        "source_url": str(lens.source_url) if lens.source_url else None,
        "scraped_at": lens.scraped_at,
    }


def _dedupe_by_slug(table: Table, rows: list[dict]) -> list[dict]:
    """Drop rows sharing a `slug` with an earlier row in the same batch.

    Postgres rejects an `ON CONFLICT DO UPDATE` batch that touches the same
    conflict-target row twice in one statement
    (`asyncpg.exceptions.CardinalityViolationError`), which would otherwise
    crash the whole upsert — losing every row in the batch, not just the
    colliding ones. `models/camera.py` and `models/lens.py` already build
    `slug` from brand+model+mount specifically to keep genuinely distinct
    products (e.g. the same lens sold on two mounts) from colliding here;
    this is the last-resort backstop for whatever that doesn't catch (a
    slugify collision, a data-quality bug upstream, ...) so one bad pair of
    records degrades to a dropped duplicate instead of dropping the batch.
    """
    seen: dict[str, dict] = {}
    duplicates: list[str] = []
    for row in rows:
        slug = row["slug"]
        if slug in seen:
            duplicates.append(slug)
            continue
        seen[slug] = row
    if duplicates:
        logger.warning(
            "Dropped %d duplicate-slug row(s) from %s upsert batch: %s",
            len(duplicates),
            table.name,
            duplicates,
        )
    return list(seen.values())


async def _upsert_rows(session: AsyncSession, table: Table, rows: list[dict]) -> int:
    if not rows:
        return 0

    rows = _dedupe_by_slug(table, rows)
    stmt = pg_insert(table).values(rows)
    excluded = stmt.excluded

    set_values = {}
    for column in table.columns:
        name = column.name
        if name in _IMMUTABLE_COLUMNS:
            continue
        if name in _PROVENANCE_COLUMNS:
            set_values[name] = getattr(excluded, name)
        else:
            # Fill the column only if it's currently null — an existing
            # validated value must never be silently overwritten by a
            # later scrape, per the pipeline's upsert contract.
            set_values[name] = func.coalesce(table.c[name], getattr(excluded, name))
    set_values["updated_at"] = func.now()

    stmt = stmt.on_conflict_do_update(index_elements=[table.c.slug], set_=set_values)
    await session.execute(stmt)
    await session.commit()
    return len(rows)


async def upsert_cameras(session: AsyncSession, cameras: list[CameraSpecs]) -> int:
    rows = [_camera_to_row(camera) for camera in cameras]
    return await _upsert_rows(session, CameraRecord.__table__, rows)


async def upsert_lenses(session: AsyncSession, lenses: list[LensSpecs]) -> int:
    rows = [_lens_to_row(lens) for lens in lenses]
    return await _upsert_rows(session, LensRecord.__table__, rows)
