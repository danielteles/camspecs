"""Playwright + BeautifulSoup scraper for Versus.com camera/lens spec pages.

Two assumptions in the original brief turned out not to hold, verified
empirically against the live site before writing this module:

1. Versus.com is fronted by AWS WAF's JS challenge (Goku/`token.awswaf.com`),
   not a bare Cloudflare TLS/JA3 check. A `curl_cffi` request impersonating
   Chrome still gets served the challenge page (HTTP 202, ~2KB of
   challenge.js boilerplate) because the challenge requires *executing* JS to
   mint an `aws-waf-token` cookie — TLS fingerprinting has nothing to solve
   there. A real browser does solve it automatically. Since Playwright is
   already a pipeline dependency (see `extractors/nikon.py`), it's reused
   here instead of adding `curl_cffi` as a second, non-functional fetch
   layer.
2. The site is not Next.js and has no `__NEXT_DATA__` script. It does embed
   a `<script type="application/json" id="payload">` blob, but that only
   carries page metadata (product name, score, images) — not spec facts.
   The actual spec table is server-rendered HTML: each fact is a
   `<tr data-spec="megapixels" ...><td class="f">Label</td><td class="v">33
   MP</td></tr>` row, which is what `beautifulsoup4` is used for here.

Run as a CLI with `python -m extractors.versus [--slug SLUG] [--type
camera|lens]` from `scripts/scraper/` (venv active).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
from typing import Any

from bs4 import BeautifulSoup
from playwright.async_api import TimeoutError as PlaywrightTimeoutError, async_playwright
from pydantic import ValidationError

from models import CameraSpecs, LensSpecs

logger = logging.getLogger(__name__)

BASE_URL = "https://versus.com/en/{slug}"
# The brief's example slug ("sony-alpha-a7-iv") 404s — Versus's canonical
# slug for this camera is "sony-alpha-7-iv" ("sony-a7-iv" also resolves, via
# redirect). Verified live.
DEFAULT_CAMERA_SLUG = "sony-alpha-7-iv"
# Versus has no standalone lens product pages for most mounts — lenses only
# appear bundled into a "camera + lens" kit slug, which is what's scraped
# for lens facts (see `map_lens_specs`'s docstring for the confirmed
# exception: Fujifilm GF lenses do have their own standalone pages).
DEFAULT_LENS_KIT_SLUG = "sony-alpha-7-iv-sony-fe-50mm-f1-8"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
NAV_TIMEOUT_MS = 30_000
SPEC_TABLE_TIMEOUT_MS = 20_000
MAX_ATTEMPTS = 2

_PAYLOAD_SCRIPT_SELECTOR = 'script#payload[type="application/json"]'
_YEAR_PATTERN = re.compile(r"\b(1[89]\d{2}|20\d{2})\b")

# Versus's 404 is a soft 404: the AWS WAF challenge response Playwright
# navigates to is always HTTP 202 regardless of whether the slug exists
# (verified live — the challenge resolves client-side without a further
# top-level navigation, so `page.goto()`'s response status never reflects
# the final rendered page). The only reliable signal is what the SPA
# renders: a real product page gets a `tr[data-spec]` row and a normal
# title, a missing one settles on `document.title === "Not found"` with no
# spec table. Racing both conditions with `wait_for_function` instead of
# waiting out the full spec-table timeout before checking resolves either
# case in ~1s (verified live) rather than the full SPEC_TABLE_TIMEOUT_MS.
_PAGE_SETTLED_JS = (
    "() => document.title === 'Not found' "
    "|| document.querySelector('tr[data-spec]') !== null"
)
_NOT_FOUND_TITLE = "Not found"


class VersusSlugError(RuntimeError):
    """Raised when a Versus.com slug doesn't resolve to a real product page.

    Distinct from the retryable `PlaywrightTimeoutError` path: a 404 is a
    fact about the slug, not a transient WAF/network hiccup, so retrying it
    would just burn the full NAV_TIMEOUT_MS/SPEC_TABLE_TIMEOUT_MS budget
    twice for a page that will never resolve (see the "guessed kit slugs
    failed with 404s" issue this was written to fix).
    """


def _spec_text(soup: BeautifulSoup, key: str) -> str | None:
    """Look up one `data-spec="key"` row's value cell, or None if missing/empty.

    Versus leaves the value cell blank for boolean facts the product lacks
    (e.g. "gps" with no value means "no GPS"), which is indistinguishable
    from a genuinely absent spec — both fail gracefully to None here.
    """
    row = soup.select_one(f'tr[data-spec="{key}"]')
    if row is None:
        return None
    value_cell = row.select_one("td.v")
    if value_cell is None:
        return None
    text = value_cell.get_text(strip=True)
    return text or None


def _parse_release_year(text: str | None) -> int | None:
    if not text:
        return None
    match = _YEAR_PATTERN.search(text)
    return int(match.group(1)) if match else None


def _split_brand_model(display_name: str) -> tuple[str, str]:
    # Versus doesn't expose brand/model as separate fields, only a combined
    # display name ("Sony Alpha 7 IV"). Every brand on the site is a single
    # word, so splitting on the first space is reliable in practice.
    parts = display_name.strip().split(" ", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return parts[0], ""


def _extract_payload(soup: BeautifulSoup) -> dict[str, Any]:
    script = soup.select_one(_PAYLOAD_SCRIPT_SELECTOR)
    if script is None or not script.string:
        return {}
    try:
        return json.loads(script.string)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Versus #payload JSON")
        return {}


def _product_display_name(soup: BeautifulSoup, payload: dict[str, Any]) -> str | None:
    products = payload.get("products") or []
    if products and products[0].get("name"):
        return products[0]["name"]
    h1 = soup.select_one("h1")
    return h1.get_text(strip=True) if h1 else None


async def _fetch_rendered_soup(slug: str) -> BeautifulSoup:
    """Navigate to a Versus product page and return its post-hydration DOM.

    Retries the whole navigation (not just the request) since a failure here
    is usually the WAF challenge not having resolved in time, which a fresh
    page load recovers from. A real 404 (see `_PAGE_SETTLED_JS`'s docstring
    note) is checked for and raised immediately instead, without retrying:
    it's a fact about the slug, not a transient failure a retry could fix,
    and every kit slug is bundle-guessed from a camera + lens pairing
    (Versus has no standalone lens pages) so 404s are the expected failure
    mode for a guess that didn't pan out, not the exception.
    """
    url = BASE_URL.format(slug=slug)
    last_exc: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                try:
                    page = await browser.new_page(user_agent=USER_AGENT)
                    await page.goto(url, timeout=NAV_TIMEOUT_MS, wait_until="domcontentloaded")
                    await page.wait_for_function(_PAGE_SETTLED_JS, timeout=SPEC_TABLE_TIMEOUT_MS)
                    if await page.title() == _NOT_FOUND_TITLE:
                        raise VersusSlugError(f"Versus slug {slug!r} does not exist (404)")
                    html = await page.content()
                finally:
                    await browser.close()
            return BeautifulSoup(html, "html.parser")
        except VersusSlugError:
            raise
        except PlaywrightTimeoutError as exc:
            last_exc = exc
            logger.warning(
                "Fetch attempt %d/%d for %s failed: %s", attempt, MAX_ATTEMPTS, slug, exc
            )
    raise RuntimeError(f"Failed to fetch {url} after {MAX_ATTEMPTS} attempts") from last_exc


def map_camera_specs(soup: BeautifulSoup, slug: str) -> dict[str, Any]:
    """Map a scraped Versus product page's DOM into a raw CameraSpecs dict."""
    payload = _extract_payload(soup)
    display_name = _product_display_name(soup, payload)
    # Kit pages ("camera + lens") only carry facts for the bundle as a
    # whole; take just the camera half of the display name so `model`
    # doesn't end up with a lens name stuck to it.
    camera_name = display_name.split(" + ", 1)[0] if display_name else None
    brand, model = _split_brand_model(camera_name) if camera_name else (None, None)

    return {
        "brand": brand,
        "model": model,
        "mount": _spec_text(soup, "lens-mount"),
        "sensor_format": _spec_text(soup, "sensor-format") or "other",
        "megapixels": _spec_text(soup, "megapixels"),
        "weight_g": _spec_text(soup, "weight"),
        "release_year": _parse_release_year(_spec_text(soup, "release-date")),
        "video_formats": (
            [v] if (v := _spec_text(soup, "video-recording")) else []
        ),
        "source": "versus",
        "source_url": BASE_URL.format(slug=slug),
    }


def map_lens_specs(soup: BeautifulSoup, slug: str) -> dict[str, Any]:
    """Map a scraped Versus lens page's DOM into a raw LensSpecs dict.

    Two page shapes exist here, verified live. Most mounts (Sony E, Canon
    RF, Nikon Z, Fujifilm X) only have "camera + lens" kit pages — Versus
    has no standalone product page for those lenses at all — so
    `display_name` there is "Camera Name + Lens Name" and only the lens half
    is used; weight and release date on a kit page are the *camera's*
    figures (verified: identical to the camera's solo page), so they're
    deliberately left unmapped rather than mis-attributed to the lens.
    Fujifilm's GF (medium format) lenses are a confirmed exception: they
    have real standalone lens pages of their own (e.g.
    "fujifilm-gf-63mm-f-2-8-r-wr"), where `display_name` is just the lens's
    own name with no " + " delimiter — detected here via `is_kit_page`. On
    a standalone page there's no camera to conflate with, so weight and
    release date genuinely belong to the lens and are safe to map.
    """
    payload = _extract_payload(soup)
    display_name = _product_display_name(soup, payload)
    is_kit_page = bool(display_name and " + " in display_name)
    lens_name = display_name.split(" + ", 1)[1] if is_kit_page else display_name
    brand, model = _split_brand_model(lens_name) if lens_name else (None, None)

    raw: dict[str, Any] = {
        "brand": brand,
        "model": model,
        "mount": _spec_text(soup, "lens-mount"),
        "min_focal_length_mm": _spec_text(soup, "minimum-focal-length"),
        "max_focal_length_mm": _spec_text(soup, "maximum-focal-length"),
        "min_aperture": _spec_text(soup, "wide-aperture"),
        "max_aperture": (
            _spec_text(soup, "small-aperture-max-focal")
            or _spec_text(soup, "small-aperture-min-focal")
        ),
        "source": "versus",
        "source_url": BASE_URL.format(slug=slug),
    }
    if not is_kit_page:
        raw["weight_g"] = _spec_text(soup, "weight")
        raw["release_year"] = _parse_release_year(_spec_text(soup, "release-date"))
    return raw


async def fetch_camera(slug: str = DEFAULT_CAMERA_SLUG) -> CameraSpecs:
    soup = await _fetch_rendered_soup(slug)
    raw = map_camera_specs(soup, slug)
    try:
        return CameraSpecs.model_validate(raw)
    except ValidationError:
        logger.warning("Versus camera %s missing required specs: %s", slug, raw)
        raise


async def fetch_lens(slug: str = DEFAULT_LENS_KIT_SLUG) -> LensSpecs:
    soup = await _fetch_rendered_soup(slug)
    raw = map_lens_specs(soup, slug)
    try:
        return LensSpecs.model_validate(raw)
    except ValidationError:
        logger.warning("Versus lens %s missing required specs: %s", slug, raw)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape a Versus.com camera or lens page.")
    parser.add_argument("--type", choices=["camera", "lens"], default="camera")
    parser.add_argument("--slug", default=None, help="Versus product slug (default depends on --type)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.type == "camera":
        camera = asyncio.run(fetch_camera(args.slug or DEFAULT_CAMERA_SLUG))
        print(camera.model_dump_json(indent=2))
    else:
        lens = asyncio.run(fetch_lens(args.slug or DEFAULT_LENS_KIT_SLUG))
        print(lens.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
