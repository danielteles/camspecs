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
from transformers.merger import (
    apply_curated_lens_release_years,
    apply_curated_sensor_format_overrides,
    drop_unmergeable_wikidata_cameras,
    merge_records,
)
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
# original entries to raise that overlap across all 5 manufacturer-scraped
# mounts (Sony E, Canon RF, Nikon Z, Fujifilm X, Fujifilm G).
#
# The two GFX entries are confirmed live standalone product pages (full
# spec table: sensor-format "Medium format", lens-mount "Fujifilm G",
# megapixels, weight, release-date all populated) — same page shape as
# every other camera slug here, nothing GFX-specific needed on the camera
# side. See DEFAULT_VERSUS_LENS_SLUGS below for the GF *lens* side, which
# did need an extractor change (extractors/versus.py's `map_lens_specs`).
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
    "fujifilm-gfx100s",
    "fujifilm-gfx100-ii",
]

# Versus.com has no standalone lens pages for most mounts — every one of
# those lens slugs is a "camera + lens" kit (see extractors/versus.py).
# Each such entry is scraped for its lens half only; the camera half is
# already covered by DEFAULT_VERSUS_CAMERA_SLUGS / DEFAULT_NIKON_URLS.
# Fujifilm's GF (medium format) lenses are the one confirmed exception —
# real standalone lens pages of their own, no kit bundling at all (verified
# live: "fujifilm-gfx100s-fujifilm-gf-32-64mm-f-4-r-lm-wr" 404s — no such
# kit page exists for any GFX body). `extractors/versus.py`'s
# `map_lens_specs` handles both page shapes.
#
# Every slug below was confirmed live (full spec table, not a 404) before
# being added — kit slugs can't be derived from a naming pattern (verified:
# "fujifilm-x-t5-fujifilm-xf-18-55mm-f2-8-4-r-lm-ois" 404s despite following
# the same "{camera-slug}-{lens-brand}-{lens-model-slug}" shape every
# working slug below does), only found via Versus's own search index or a
# page's "cheap alternatives" links.
#
# Fujifilm X's 3 entries don't pair with either Fujifilm body in
# DEFAULT_VERSUS_CAMERA_SLUGS (x-t5, x-t50) — searching those specific
# bodies for a kit still turns up nothing live. The lens half doesn't need
# to match our curated camera list, though: these 3 are still real, live
# Fujifilm X-mount kit pages contributing real lens data, just bundled with
# other Fujifilm bodies (X-E5, X-S10) that happen to have Versus kit
# coverage. Note also: curl_cffi (even with Chrome TLS impersonation,
# verified live) never gets past this — it only ever receives Versus's AWS
# WAF JS-challenge page (HTTP 202, no real content), the same constraint
# documented in extractors/versus.py for the whole site; every slug here
# was found and confirmed via a real browser instead.
#
# The 3 Fujifilm G entries were found via Versus's own search index
# ("fujifilm gf") rather than a camera-page's "cheap alternatives" list —
# every GFX camera's alternatives are cross-brand kits (Canon/Sony/Nikon),
# never a Fujifilm GF pairing, so that discovery path doesn't apply here.
DEFAULT_VERSUS_LENS_SLUGS = [
    "sony-alpha-7-iv-sony-fe-50mm-f1-8",  # Sony E
    "sony-alpha-6700-sony-e-18-135mm-f3-5-5-6-oss",  # Sony E
    "canon-eos-r6-mark-ii-canon-rf-24-105mm-f-4l-is-usm",  # Canon RF
    "canon-eos-r8-canon-rf-24-50mm-f-4-5-6-3-is-stm",  # Canon RF
    "canon-eos-r5-canon-rf-24-105mm-f-4l-is-usm",  # Canon RF
    "nikon-z6-iii-nikon-nikkor-z-24-120mm-f-4-s",  # Nikon Z
    "nikon-zf-nikon-nikkor-z-40mm-f-2-se",  # Nikon Z
    "fujifilm-x-e5-fujifilm-xf-23mm-f-2-8-r-wr",  # Fujifilm X
    "fujifilm-x-s10-fujifilm-xf-18-55mm-f2-8-4-r-lm-ois",  # Fujifilm X
    "fujifilm-x-s10-fujifilm-fujinon-xf-16-80mm-f-4-r-ois-wr",  # Fujifilm X
    "fujifilm-gf-32-64mm-f-4-r-lm-wr",  # Fujifilm G (standalone page)
    "fujifilm-gf-63mm-f-2-8-r-wr",  # Fujifilm G (standalone page)
    "fujifilm-fujinon-gf-80mm-f-1-7-r-wr",  # Fujifilm G (standalone page)
]

# Wikidata QIDs for each lens-kit slug's lens half, verified live — used
# only to backfill release_year. Versus's kit pages deliberately don't
# expose the lens's own release date (see extractors/versus.py's
# map_lens_specs docstring: a kit's page only carries the camera's date,
# and attaching that to the lens would misattribute it — a lens can predate
# or postdate its kit camera by years), so it's never available from Versus
# itself. Confirmed live, per QID, that Wikidata's own record has the
# property populated at all before adding an entry here: 5 of these 6 items
# have no P577/P6949 date statement whatsoever (a genuine upstream gap, not
# a query-limit issue) and correctly backfill to still-null; only
# sony-fe-50mm-f1-8 (Q30645819) has one, and it's missed by the general
# Wikidata lens crawl's recency-ordered LIMIT window since the lens dates to
# 2016 — same reasoning as NIKON_WIKIDATA_QIDS above, applied to lenses.
VERSUS_LENS_WIKIDATA_QIDS = {
    "sony-alpha-7-iv-sony-fe-50mm-f1-8": "Q30645819",
    "sony-alpha-6700-sony-e-18-135mm-f3-5-5-6-oss": "Q116257084",
    "canon-eos-r6-mark-ii-canon-rf-24-105mm-f-4l-is-usm": "Q97154591",
    "canon-eos-r8-canon-rf-24-50mm-f-4-5-6-3-is-stm": "Q123130447",
    "canon-eos-r5-canon-rf-24-105mm-f-4l-is-usm": "Q97154591",
    "nikon-z6-iii-nikon-nikkor-z-24-120mm-f-4-s": "Q116719408",
    "nikon-zf-nikon-nikkor-z-40mm-f-2-se": "Q116719420",
}


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


def _merge_unique(curated: list[str], discovered: list[str]) -> list[str]:
    """Curated slugs first (so the QID backfill maps above still line up by value), then any newly discovered slug not already covered."""
    seen = set(curated)
    return curated + [slug for slug in discovered if slug not in seen]


# The single allowlist every fetched record's mount is checked against,
# regardless of source. extractors/wikidata.py's SPARQL queries already only
# ever bind ?mount to one of MOUNT_QIDS's keys, so this is a no-op there —
# but extractors/versus.py has no equivalent query-level restriction (it
# fetches by slug, then reads whatever mount text the page has), so nothing
# upstream of this stops a DSLR/legacy-mount or not-yet-approved-mount
# product from reaching the DB otherwise. Confirmed live: enabling
# versus.discover_all_slugs()'s brand-only filter (see extractors/versus.py)
# let Canon EF, Nikon F, Pentax K, Sony A-mount, and Hasselblad X-mount
# records all the way through to a real upsert before this check existed.
# Applied once here, after every source's fetch, rather than per-source, so
# it can never be bypassed by a future source that forgets its own check.
SUPPORTED_MOUNTS = frozenset(wikidata.MOUNT_QIDS.keys())


def _drop_unsupported_mounts(
    cameras: list[CameraSpecs], lenses: list[LensSpecs]
) -> tuple[list[CameraSpecs], list[LensSpecs]]:
    kept_cameras = [c for c in cameras if c.mount in SUPPORTED_MOUNTS]
    kept_lenses = [l for l in lenses if l.mount in SUPPORTED_MOUNTS]
    dropped_cameras = len(cameras) - len(kept_cameras)
    dropped_lenses = len(lenses) - len(kept_lenses)
    if dropped_cameras or dropped_lenses:
        logger.warning(
            "Dropped %d camera(s), %d lens(es) with an unsupported mount",
            dropped_cameras,
            dropped_lenses,
        )
    return kept_cameras, kept_lenses


async def fetch_all(
    wikidata_camera_limit: int,
    wikidata_lens_limit: int,
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
            wikidata.fetch_cameras(client, wikidata_camera_limit),
            wikidata.fetch_lenses(client, wikidata_lens_limit),
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
            lens = await versus.fetch_lens(slug)
        except Exception:
            logger.exception("Skipping Versus lens slug after repeated failures: %s", slug)
            continue

        qid = VERSUS_LENS_WIKIDATA_QIDS.get(slug)
        if lens.release_year is None and qid:
            try:
                async with httpx.AsyncClient(
                    headers={"User-Agent": wikidata.USER_AGENT}, timeout=wikidata.REQUEST_TIMEOUT_S
                ) as wikidata_client:
                    lens.release_year = await wikidata.fetch_release_year(wikidata_client, qid)
            except Exception:
                logger.warning("Could not backfill release_year for %s from Wikidata", slug)

        lenses.append(lens)

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

    versus_camera_slugs = args.versus_camera_slugs
    versus_lens_slugs = args.versus_lens_slugs
    if args.discover_versus_slugs:
        with Timer("Discover Versus slugs"):
            discovered_cameras, discovered_lenses = await versus.discover_all_slugs()
        versus_camera_slugs = _merge_unique(versus_camera_slugs, discovered_cameras)
        versus_lens_slugs = _merge_unique(versus_lens_slugs, discovered_lenses)
        logger.info(
            "Discovery added %d camera slug(s), %d lens slug(s) to the curated defaults",
            len(versus_camera_slugs) - len(args.versus_camera_slugs),
            len(versus_lens_slugs) - len(args.versus_lens_slugs),
        )

    with Timer("Fetch") as t_fetch:
        raw_cameras, raw_lenses = await fetch_all(
            args.wikidata_camera_limit,
            args.wikidata_lens_limit,
            args.nikon_urls,
            versus_camera_slugs,
            versus_lens_slugs,
        )
    logger.info(
        "Fetched %d raw camera record(s), %d raw lens record(s)", len(raw_cameras), len(raw_lenses)
    )
    raw_cameras, raw_lenses = _drop_unsupported_mounts(raw_cameras, raw_lenses)

    with Timer("Merge") as t_merge:
        cameras = merge_records(raw_cameras)
        lenses = merge_records(raw_lenses)
        cameras = apply_curated_sensor_format_overrides(cameras)
        pre_filter_count = len(cameras)
        cameras = drop_unmergeable_wikidata_cameras(cameras)
        cameras = backfill_sensor_dimensions(cameras)
        lenses = apply_curated_lens_release_years(lenses)
    logger.info("Merged into %d camera(s), %d lens(es)", len(cameras), len(lenses))
    if pre_filter_count != len(cameras):
        logger.info(
            "Dropped %d Wikidata-only camera(s) with no resolvable sensor format",
            pre_filter_count - len(cameras),
        )

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
        "--wikidata-camera-limit",
        type=int,
        default=150,
        help=(
            "Camera entity budget from Wikidata, split evenly across mounts so a "
            "low-cadence mount (e.g. Fujifilm G) isn't crowded out of its share by a "
            "high-cadence one (see extractors/wikidata.py's _per_mount_limit)"
        ),
    )
    parser.add_argument(
        "--wikidata-lens-limit",
        type=int,
        default=200,
        help="Lens entity budget from Wikidata, split evenly across mounts (same reasoning "
        "as --wikidata-camera-limit)",
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
        "--discover-versus-slugs",
        action="store_true",
        help="Crawl versus.com/en/camera and /en/camera-lens for additional slugs, merged with "
        "--versus-camera-slugs / --versus-lens-slugs before fetching",
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
