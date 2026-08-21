"""Live integration test for the Postgres upsert layer.

Requires a real Postgres instance reachable via DATABASE_URL (see
.env.example). Run with `python -m tests.test_upsert` from
`scripts/scraper/` (venv active). Creates the schema if needed, then proves
the upsert contract: a fresh slug is inserted, and a second upsert on the
same slug fills in previously-null fields *without* overwriting fields that
already had a validated value — even when the second run's incoming value
for that field conflicts with what's already stored.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from db.connection import dispose_engine, get_engine, get_session_factory
from db.schema import CameraRecord, create_all
from db.upsert import upsert_cameras
from models import CameraSpecs

# First pass: weight known, release_year not yet known.
CAMERA_V1 = {
    "brand": "TestBrand",
    "model": "Upsert Test Camera",
    "mount": "Test Mount",
    "sensor_format": "full-frame",
    "weight_g": 670,
    "source": "manufacturer:test",
    "source_url": "https://example.com/v1",
}

# Second pass (same slug): release_year now known (should backfill), but
# weight_g conflicts with what's already stored (must NOT overwrite).
CAMERA_V2 = {
    "brand": "TestBrand",
    "model": "Upsert Test Camera",
    "mount": "Test Mount",
    "sensor_format": "full-frame",
    "weight_g": 999,  # conflicts with the already-stored 670 — must be ignored
    "release_year": 2024,  # new field — must be backfilled
    "source": "wikidata",
    "source_url": "https://example.com/v2",
}


async def main() -> None:
    engine = get_engine()
    await create_all(engine)
    session_factory = get_session_factory()

    async with session_factory() as session:
        # Clean slate for the test slug so re-runs are deterministic.
        camera_v1 = CameraSpecs.model_validate(CAMERA_V1)
        await session.execute(
            CameraRecord.__table__.delete().where(CameraRecord.slug == camera_v1.slug)
        )
        await session.commit()

        count = await upsert_cameras(session, [camera_v1])
        print(f"First upsert: {count} row(s) written")

        row = (
            await session.execute(select(CameraRecord).where(CameraRecord.slug == camera_v1.slug))
        ).scalar_one()
        print(f"After insert: weight_g={row.weight_g}, release_year={row.release_year}, "
              f"source={row.source!r}")
        assert row.weight_g == 670
        assert row.release_year is None
        assert row.source == "manufacturer:test"

        camera_v2 = CameraSpecs.model_validate(CAMERA_V2)
        count = await upsert_cameras(session, [camera_v2])
        print(f"Second upsert: {count} row(s) written")

        session.expire_all()
        row = (
            await session.execute(select(CameraRecord).where(CameraRecord.slug == camera_v1.slug))
        ).scalar_one()
        print(f"After update:  weight_g={row.weight_g}, release_year={row.release_year}, "
              f"source={row.source!r}")
        assert row.weight_g == 670, "existing validated weight_g must not be overwritten"
        assert row.release_year == 2024, "null release_year must be backfilled"
        assert row.source == "wikidata", "provenance fields must always refresh"

        # Cleanup so the test table doesn't accumulate fixture rows.
        await session.execute(
            CameraRecord.__table__.delete().where(CameraRecord.slug == camera_v1.slug)
        )
        await session.commit()

    await dispose_engine()
    print("\nOK  upsert contract verified against live Postgres.")


if __name__ == "__main__":
    asyncio.run(main())
