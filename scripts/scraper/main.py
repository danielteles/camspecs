"""Main pipeline orchestrator: Fetch -> Merge -> Validate -> Upsert -> Revalidate.

Run with `python main.py` from `scripts/scraper/` (venv active). See
`python main.py --help` for flags to scope sources or skip the DB/
revalidation steps for a dry run.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import time

import httpx
from dotenv import load_dotenv

from db.connection import dispose_engine, get_engine, get_session_factory
from db.schema import create_all
from db.upsert import upsert_cameras, upsert_lenses
from extractors import nikon, versus, wikidata
from models import CameraSpecs, LensSpecs
from transformers.merger import merge_records
from transformers.sensor_fallback import backfill_sensor_dimensions

load_dotenv()
logger = logging.getLogger(__name__)

DEFAULT_NIKON_URLS = [
    "https://www.nikonusa.com/p/z6iii/1890/overview",
    "https://www.nikonusa.com/p/z50ii/2044/overview",
]

# Wikidata QIDs for the cameras at each Nikon URL above, verified live —
# used only to backfill release_year (see fetch_all below and
# wikidata.fetch_release_year's docstring for why the general Wikidata
# camera crawl can't reach these two items itself: neither has a P2935
# mount statement on Wikidata, so they fail that query's required join).
NIKON_WIKIDATA_QIDS = {
    "https://www.nikonusa.com/p/z6iii/1890/overview": "Q126959969",
    "https://www.nikonusa.com/p/z50ii/2044/overview": "Q131199641",
}

# Slugs verified live against versus.com (see extractors/versus.py's own
# note on verifying rather than guessing slugs). Wikidata's sensor_format is
# always "other" (no populated property for it) and only gets backfilled by
# whichever of these cameras also happens to come back from Wikidata's
# recency-ordered crawl — so this list is deliberately broader than the 3
# original entries to raise that overlap across all 4 manufacturer-scraped
# mounts (Sony E, Canon RF, Nikon Z, Fujifilm X).
DEFAULT_VERSUS_CAMERA_SLUGS = [
    "sony-alpha-7-iv",
    "sony-alpha-6700",
    "canon-eos-r6-mark-ii",
    "canon-eos-r8",
    "canon-eos-r5",
    "nikon-z6-iii",
    "nikon-zf",
    "fujifilm-x-t5",
    "fujifilm-x-t50",
]

# Versus.com has no standalone lens pages — every lens slug is a "camera +
# lens" kit (see extractors/versus.py). Each entry here is scraped for its
# lens half only; the camera half is already covered by
# DEFAULT_VERSUS_CAMERA_SLUGS / DEFAULT_NIKON_URLS.
DEFAULT_VERSUS_LENS_SLUGS = [
    "sony-alpha-7-iv-sony-fe-50mm-f1-8",
]


class Timer:
    """Context manager that logs and records a pipeline phase's duration."""

    def __init__(self, label: str) -> None:
        self.label = label
        self.elapsed: float = 0.0

    def __enter__(self) -> "Timer":
        self._start = time.perf_counter()
        logger.info("-> %s", self.label)
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.elapsed = time.perf_counter() - self._start
        status = "failed" if exc_type else "done"
        logger.info("<- %s (%s) in %.2fs", self.label, status, self.elapsed)


async def fetch_all(
    wikidata_limit: int,
    nikon_urls: list[str],
    versus_camera_slugs: list[str],
    versus_lens_slugs: list[str],
) -> tuple[list[CameraSpecs], list[LensSpecs]]:
    cameras: list[CameraSpecs] = []
    lenses: list[LensSpecs] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": wikidata.USER_AGENT}, timeout=wikidata.REQUEST_TIMEOUT_S
    ) as client:
        wikidata_cameras, wikidata_lenses = await asyncio.gather(
            wikidata.fetch_cameras(client, wikidata_limit),
            wikidata.fetch_lenses(client, wikidata_limit),
        )
    cameras.extend(wikidata_cameras)
    lenses.extend(wikidata_lenses)

    for url in nikon_urls:
        try:
            camera = await nikon.fetch_camera(url)
        except Exception:
            # One manufacturer page changing layout shouldn't take down a
            # pipeline run that's otherwise fine — log and keep going.
            logger.exception("Skipping Nikon URL after repeated failures: %s", url)
            continue

        qid = NIKON_WIKIDATA_QIDS.get(url)
        if camera.release_year is None and qid:
            try:
                async with httpx.AsyncClient(
                    headers={"User-Agent": wikidata.USER_AGENT}, timeout=wikidata.REQUEST_TIMEOUT_S
                ) as wikidata_client:
                    camera.release_year = await wikidata.fetch_release_year(wikidata_client, qid)
            except Exception:
                logger.warning("Could not backfill release_year for %s from Wikidata", url)

        cameras.append(camera)

    for slug in versus_camera_slugs:
        try:
            cameras.append(await versus.fetch_camera(slug))
        except Exception:
            # Same reasoning as the Nikon loop above — a WAF challenge that
            # didn't resolve or a page-layout change for one slug shouldn't
            # take down the rest of the fetch phase.
            logger.exception("Skipping Versus camera slug after repeated failures: %s", slug)

    for slug in versus_lens_slugs:
        try:
            lenses.append(await versus.fetch_lens(slug))
        except Exception:
            logger.exception("Skipping Versus lens slug after repeated failures: %s", slug)

    return cameras, lenses


async def revalidate_site(
    site_url: str, secret: str, cameras: list[CameraSpecs], lenses: list[LensSpecs]
) -> None:
    payload = {
        "cameras": [camera.slug for camera in cameras],
        "lenses": [lens.slug for lens in lenses],
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{site_url.rstrip('/')}/api/revalidate",
            json=payload,
            headers={"Authorization": f"Bearer {secret}"},
        )
        response.raise_for_status()
    logger.info("Revalidated %d camera page(s), %d lens page(s)", len(cameras), len(lenses))


async def run_pipeline(args: argparse.Namespace) -> None:
    pipeline_start = time.perf_counter()

    with Timer("Fetch") as t_fetch:
        raw_cameras, raw_lenses = await fetch_all(
            args.wikidata_limit, args.nikon_urls, args.versus_camera_slugs, args.versus_lens_slugs
        )
    logger.info(
        "Fetched %d raw camera record(s), %d raw lens record(s)", len(raw_cameras), len(raw_lenses)
    )

    with Timer("Merge") as t_merge:
        cameras = merge_records(raw_cameras)
        lenses = merge_records(raw_lenses)
        cameras = backfill_sensor_dimensions(cameras)
    logger.info("Merged into %d camera(s), %d lens(es)", len(cameras), len(lenses))

    with Timer("Validate") as t_validate:
        # Every record is already a validated Pydantic instance by this
        # point (fetch and merge both run model_validate) — this stage is
        # the final confirmation + count, not new validation work.
        assert all(isinstance(camera, CameraSpecs) for camera in cameras)
        assert all(isinstance(lens, LensSpecs) for lens in lenses)

    if args.dry_run:
        logger.info("Dry run: skipping DB upsert and revalidation")
        return

    with Timer("Upsert") as t_upsert:
        engine = get_engine()
        await create_all(engine)
        session_factory = get_session_factory()
        async with session_factory() as session:
            camera_count = await upsert_cameras(session, cameras)
            lens_count = await upsert_lenses(session, lenses)
        await dispose_engine()
    logger.info("Upserted %d camera row(s), %d lens row(s)", camera_count, lens_count)

    if args.skip_revalidate:
        logger.info("Skipping cache revalidation (--skip-revalidate)")
    else:
        secret = os.environ.get("REVALIDATION_SECRET")
        if not secret:
            logger.warning("REVALIDATION_SECRET not set — skipping cache revalidation")
        else:
            with Timer("Revalidate"):
                try:
                    await revalidate_site(args.site_url, secret, cameras, lenses)
                except httpx.HTTPError as exc:
                    # Data is already safely committed to Postgres at this
                    # point; a revalidation failure (e.g. the site isn't
                    # deployed/running) shouldn't be treated as a sync
                    # failure.
                    logger.warning("Cache revalidation failed, continuing: %s", exc)

    total = time.perf_counter() - pipeline_start
    logger.info(
        "Pipeline complete in %.2fs (fetch=%.2fs merge=%.2fs validate=%.2fs upsert=%.2fs)",
        total,
        t_fetch.elapsed,
        t_merge.elapsed,
        t_validate.elapsed,
        t_upsert.elapsed,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the full camspecs scraper pipeline.")
    parser.add_argument(
        "--wikidata-limit", type=int, default=25, help="Max entities per type from Wikidata"
    )
    parser.add_argument(
        "--nikon-urls",
        nargs="*",
        default=DEFAULT_NIKON_URLS,
        help="Nikon USA product page URLs to scrape",
    )
    parser.add_argument(
        "--versus-camera-slugs",
        nargs="*",
        default=DEFAULT_VERSUS_CAMERA_SLUGS,
        help="Versus.com camera product slugs to scrape",
    )
    parser.add_argument(
        "--versus-lens-slugs",
        nargs="*",
        default=DEFAULT_VERSUS_LENS_SLUGS,
        help="Versus.com 'camera + lens' kit slugs to scrape for their lens half",
    )
    parser.add_argument(
        "--site-url",
        default=os.environ.get("SITE_URL", "http://localhost:3000"),
        help="Next.js site base URL for cache revalidation",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch/merge/validate only — skip DB upsert and revalidation",
    )
    parser.add_argument(
        "--skip-revalidate",
        action="store_true",
        help="Upsert to DB but skip the revalidation HTTP call",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(run_pipeline(args))


if __name__ == "__main__":
    main()
