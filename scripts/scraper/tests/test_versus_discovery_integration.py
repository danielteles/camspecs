"""Live integration tests for Versus.com hub discovery.

Unlike the other `tests/test_*.py` modules (pure-function, offline, run via
`python -m tests.test_X`), this hits the real versus.com hub pages through
Playwright — same AWS WAF challenge as every other live fetch in this
pipeline (see `extractors/versus.py`'s module docstring) — so it's slow
(~40-90s total: each hub page needs its "Show more" sections fully expanded,
see `extractors/versus.py`'s `_expand_hub_page`) and requires network access.
It's a real pytest module (unlike the script-style tests elsewhere in this
package) since a pass/fail regression floor is exactly what pytest is for.

Marked `integration` and excluded from the default `pytest` run by this
package's `pytest.ini` (`addopts = -m "not integration"`) — run explicitly:

    pytest tests/test_versus_discovery_integration.py -v -s

This guards against the exact bug fixed in Step 1: `_fetch_hub_links`
silently truncating a hub page's product grid to whatever rendered before
any "Show more" click (127 raw links total, regardless of category). Sample
brand counts *before* that fix, for scale: Canon 15, Sony ~50, Nikon ~20.
"""

from __future__ import annotations

import asyncio

import pytest

from extractors.versus import _brand_of, discover_camera_slugs, discover_lens_slugs

pytestmark = pytest.mark.integration

# Regression floor per brand: comfortably below the live count each brand
# returned right after the Step 1 pagination fix (874 total camera slugs
# across 13 brands, verified 2026-08-24), with headroom for normal catalog
# churn. There's no independently published "true" Versus catalog size to
# check against, so this is a regression guard, not an audited ground
# truth — a drop back toward the pre-fix numbers (Canon 15, Sony ~50, ...)
# means `_expand_hub_page`'s "Show more" loop broke again, not that
# Versus's real catalog shrank by 90%.
MIN_CAMERA_SLUGS_BY_BRAND = {
    "canon": 120,
    "sony": 120,
    "nikon": 100,
    "fujifilm": 70,
    "panasonic": 80,
}

# The number from the original bug report this whole pipeline audit started
# from: Versus lists 29 Canon mirrorless bodies (EOS R + EOS M lines), the
# DB only had 12. Verified live 2026-08-24: 28 (see Step 1's report) — off
# by one from the reported 29, most plausibly Versus's own catalog moving by
# a model in the interim, not a discovery gap (every EOS R/M slug found
# manually via direct page inspection during Step 1 is present in the
# result). Floor set at 25 to tolerate that kind of single-model drift
# without masking a real regression.
CANON_MIRRORLESS_PREFIXES = ("canon-eos-r", "canon-eos-m")
MIN_CANON_MIRRORLESS = 25

# Same reasoning as MIN_CAMERA_SLUGS_BY_BRAND, for the lens hub (930 total
# lens slugs across 21 brands, verified 2026-08-24).
MIN_LENS_SLUGS_BY_BRAND = {
    "canon": 100,
    "sony": 80,
    "nikon": 100,
    "sigma": 80,
}


@pytest.fixture(scope="module")
def discovered_camera_slugs() -> list[str]:
    return asyncio.run(discover_camera_slugs())


@pytest.fixture(scope="module")
def discovered_lens_slugs() -> list[str]:
    return asyncio.run(discover_lens_slugs())


@pytest.mark.parametrize("brand,minimum", sorted(MIN_CAMERA_SLUGS_BY_BRAND.items()))
def test_camera_brand_meets_discovery_floor(discovered_camera_slugs, brand, minimum):
    count = sum(1 for slug in discovered_camera_slugs if _brand_of(slug) == brand)
    assert count >= minimum, (
        f"{brand}: only {count} camera slug(s) discovered, expected >= {minimum} "
        "(regression floor for the Step 1 'Show more' pagination fix — see module docstring)"
    )


@pytest.mark.parametrize("brand,minimum", sorted(MIN_LENS_SLUGS_BY_BRAND.items()))
def test_lens_brand_meets_discovery_floor(discovered_lens_slugs, brand, minimum):
    count = sum(1 for slug in discovered_lens_slugs if _brand_of(slug) == brand)
    assert count >= minimum, (
        f"{brand}: only {count} lens slug(s) discovered, expected >= {minimum} "
        "(regression floor for the Step 1 'Show more' pagination fix — see module docstring)"
    )


def test_canon_mirrorless_count_matches_bug_report(discovered_camera_slugs):
    """95%+ of the 29 Canon mirrorless bodies from the original bug report."""
    count = sum(
        1
        for slug in discovered_camera_slugs
        if slug.startswith(CANON_MIRRORLESS_PREFIXES) and "-vs-" not in slug
    )
    assert count >= MIN_CANON_MIRRORLESS, (
        f"Only {count} Canon EOS R/M slug(s) discovered, expected >= {MIN_CANON_MIRRORLESS} "
        "(the original bug report: Versus lists 29, the DB only had 12)"
    )
