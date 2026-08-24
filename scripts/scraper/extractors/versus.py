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

# Category hub pages, not product pages — each lists every product Versus
# has under that category as a plain <a href="/en/{slug}"> link in
# server-rendered HTML. A prior version of this comment claimed both hubs
# were static single-load pages based on `?page=2` and scroll-to-bottom
# returning an identical 127/132-link set — that check was incomplete and
# the conclusion was wrong. Verified live: the grid is paginated per
# category *section* (e.g. "Mirrorless", "DSLR", "Compact") behind a
# client-side "Show more" button that neither URL params nor scrolling
# trigger — only clicking it does. Confirmed live on /en/camera: the raw
# link count on first render is 127, but clicking every "Show more" button
# to exhaustion (each click can reveal a further one for the same section)
# grows it to 981, and Canon's own slug count alone goes from 15 to 160.
# See `_expand_hub_page`. Same AWS WAF constraint as product pages applies
# (see module docstring) — Playwright required, curl_cffi never gets past
# the challenge.
_HUB_PATHS = {"camera": "camera", "lens": "camera-lens"}
_HUB_URL = "https://versus.com/en/{path}"
# A hub page's *first* render is "settled" once its product grid has
# rendered — picked over waiting a fixed delay since the WAF challenge
# resolution time is variable. 20 is well under the pre-expansion count
# (127/132 verified live) but far above the ~13-item site nav/footer link
# set present before the grid loads, so it can't false-positive on the
# pre-render DOM. This only detects the *initial* grid — `_expand_hub_page`
# handles paginating the rest via "Show more".
_HUB_SETTLED_JS = "() => document.querySelectorAll('a[href^=\"/en/\"]').length > 20"
# Exact text on every "Show more" pagination control, verified live across
# all sections on both /en/camera and /en/camera-lens.
_SHOW_MORE_TEXT = "Show more"
# Safety cap on the expand loop, well above the 18 clicks verified live to
# fully exhaust /en/camera's sections — guards against the loop never
# terminating if a future site change makes the button reappear instead of
# vanishing once a section is fully expanded.
MAX_SHOW_MORE_CLICKS = 300

# A discovered slug is treated as a real product page only if its leading
# hyphen-segment matches a known equipment brand. Verified live against
# versus.com/en/camera and /en/camera-lens: every non-product link on those
# two hub pages is either site nav/footer noise (/en/phone, /en/cpu, /en/tv,
# /en/laptop, /en/headphone, /en/tablet, /en/graphics-card, /en/news,
# /en/glossary, /en/categories, /en/suggest-product) or the hub's own
# self-link (/en/camera, /en/camera-lens) or a sub-filter path
# (/en/camera/top, /en/camera-lens/canon) — none of which start with a brand
# token, so this single check replaces a separately maintained denylist.
# Ricoh/Pentax are included even though Ricoh's GR line is fixed-lens (no
# interchangeable mount): a slug that doesn't validate as CameraSpecs is
# already skipped gracefully by main.py's per-slug fetch loop, so being
# slightly inclusive here costs nothing.
KNOWN_BRAND_PREFIXES = (
    "sony",
    "canon",
    "nikon",
    "fujifilm",
    "panasonic",
    "olympus",
    "om-system",
    "leica",
    "hasselblad",
    "pentax",
    "ricoh",
    "sigma",
    "tamron",
    "zeiss",
    "viltrox",
    "samyang",
    "yongnuo",
    "meike",
    "tokina",
    "voigtlander",
    "laowa",
    "irix",
    "7artisans",
)
# Versus's own comparison pages ("X vs Y") share the product-page URL shape
# and pass the brand-prefix check (the left-hand product is always a real
# brand), so they need a dedicated exclusion.
_COMPARISON_MARKER = "-vs-"


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



# OM System is the one brand in KNOWN_BRAND_PREFIXES that isn't a single
# word, so the naive first-space split below mis-parses it: a camera page's
# "OM System OM-1 Mark II" split on the first space alone yields
# brand="OM", model="System OM-1 Mark II" — the word "System" leaks into
# the model text as well as the brand being truncated. Confirmed live:
# lens pages hyphenate it instead ("OM-System M.Zuiko..."), which the
# naive split parses correctly as one token — so this only bites camera
# pages. Checked case-insensitively and before the generic split.
_MULTI_WORD_BRAND_PREFIXES = ("OM System",)


def _split_brand_model(display_name: str) -> tuple[str, str]:
    # Versus doesn't expose brand/model as separate fields, only a combined
    # display name ("Sony Alpha 7 IV"). Every brand on the site but OM
    # System (see _MULTI_WORD_BRAND_PREFIXES) is a single word, so splitting
    # on the first space is reliable for everything else.
    stripped = display_name.strip()
    for brand in _MULTI_WORD_BRAND_PREFIXES:
        if stripped.lower().startswith(brand.lower() + " "):
            return brand, stripped[len(brand) :].strip()

    parts = stripped.split(" ", 1)
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


async def _expand_hub_page(page: Any) -> int:
    """Click every "Show more" button on a hub page until none remain.

    Each click can reveal a further "Show more" for the same section (18
    clicks were needed to fully exhaust /en/camera, verified live), so this
    loops on presence of the button rather than clicking once per section.
    Always re-queries via `get_by_text` instead of caching a locator list,
    since clicking reflows the DOM and can invalidate stale handles.
    """
    clicks = 0
    for _ in range(MAX_SHOW_MORE_CLICKS):
        buttons = page.get_by_text(_SHOW_MORE_TEXT, exact=True)
        if await buttons.count() == 0:
            break
        link_count_js = "() => document.querySelectorAll('a[href^=\"/en/\"]').length"
        before = await page.evaluate(link_count_js)
        try:
            await buttons.first.scroll_into_view_if_needed(timeout=2000)
            await buttons.first.click(timeout=2000)
        except PlaywrightTimeoutError:
            # Button is present but not interactable (e.g. a transient
            # overlay) — stop rather than spin on the same one forever.
            break
        clicks += 1
        try:
            await page.wait_for_function(
                "(n) => document.querySelectorAll('a[href^=\"/en/\"]').length > n",
                arg=before,
                timeout=5000,
            )
        except PlaywrightTimeoutError:
            # The click didn't grow the link count in time — the section may
            # have genuinely had no more items despite the button being
            # present momentarily. Keep looping; the count-0 check above is
            # what actually terminates.
            pass
    return clicks


async def _fetch_hub_links(path: str) -> list[str]:
    """Navigate to a Versus.com category hub page and return every raw `/en/...` href on it.

    Retries the whole navigation like `_fetch_rendered_soup` does, for the
    same reason: a failure here is almost always the WAF challenge not
    having resolved in time, which a fresh load recovers from.
    """
    url = _HUB_URL.format(path=path)
    last_exc: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                try:
                    page = await browser.new_page(user_agent=USER_AGENT)
                    await page.goto(url, timeout=NAV_TIMEOUT_MS, wait_until="domcontentloaded")
                    await page.wait_for_function(_HUB_SETTLED_JS, timeout=SPEC_TABLE_TIMEOUT_MS)
                    clicks = await _expand_hub_page(page)
                    logger.info("Expanded %s hub page: clicked 'Show more' %d time(s)", path, clicks)
                    return await page.eval_on_selector_all(
                        "a[href^='/en/']", "els => els.map(e => e.getAttribute('href'))"
                    )
                finally:
                    await browser.close()
        except PlaywrightTimeoutError as exc:
            last_exc = exc
            logger.warning(
                "Hub fetch attempt %d/%d for %s failed: %s", attempt, MAX_ATTEMPTS, path, exc
            )
    raise RuntimeError(f"Failed to fetch {url} after {MAX_ATTEMPTS} attempts") from last_exc


def _is_product_slug(slug: str) -> bool:
    if "/" in slug or _COMPARISON_MARKER in slug:
        return False
    return any(slug == prefix or slug.startswith(f"{prefix}-") for prefix in KNOWN_BRAND_PREFIXES)


def _brand_of(slug: str) -> str | None:
    return next(
        (prefix for prefix in KNOWN_BRAND_PREFIXES if slug == prefix or slug.startswith(f"{prefix}-")),
        None,
    )


def _log_discovery_breakdown(kind: str, raw_hrefs: set[str], kept_slugs: list[str]) -> None:
    """Log per-brand discovered (raw hrefs, pre-filter) vs kept (validated product slugs) counts.

    "Discovered" is intentionally the noisier pre-filter number — it also
    counts things `_is_product_slug` throws out for that brand (mainly "X
    vs Y" comparison pages, since those share a real product's brand
    prefix) — so the gap between the two columns shows how much filtering
    actually removed, not just the final count.
    """
    raw_by_brand: dict[str, int] = {}
    for href in raw_hrefs:
        brand = _brand_of(href.removeprefix("/en/"))
        if brand:
            raw_by_brand[brand] = raw_by_brand.get(brand, 0) + 1
    kept_by_brand: dict[str, int] = {}
    for slug in kept_slugs:
        brand = _brand_of(slug)
        if brand:
            kept_by_brand[brand] = kept_by_brand.get(brand, 0) + 1
    for brand in sorted(set(raw_by_brand) | set(kept_by_brand)):
        logger.info(
            "%s discovery — %s: %d discovered, %d kept",
            kind,
            brand.capitalize(),
            raw_by_brand.get(brand, 0),
            kept_by_brand.get(brand, 0),
        )


async def discover_camera_slugs() -> list[str]:
    """Crawl versus.com/en/camera and return every real camera product slug found there."""
    hrefs = await _fetch_hub_links(_HUB_PATHS["camera"])
    raw_hrefs = set(hrefs)
    slugs = {href.removeprefix("/en/") for href in raw_hrefs}
    kept = sorted(slug for slug in slugs if _is_product_slug(slug))
    _log_discovery_breakdown("Camera", raw_hrefs, kept)
    return kept


async def discover_lens_slugs() -> list[str]:
    """Crawl versus.com/en/camera-lens and return every real lens product slug found there.

    These are standalone lens pages, not "camera + lens" kit slugs — Versus
    has expanded standalone lens coverage since `DEFAULT_VERSUS_LENS_SLUGS`
    in main.py was curated (verified live: e.g. `sony-fe-24-70mm-f-2-8-gm-ii`
    has its own full spec table with lens-owned weight/release-date, not a
    kit page). `map_lens_specs`'s existing `is_kit_page` check already
    handles this shape correctly with no changes needed — it was never
    Fujifilm-GF-specific in implementation, only in which slugs had been
    curated by hand so far.
    """
    hrefs = await _fetch_hub_links(_HUB_PATHS["lens"])
    raw_hrefs = set(hrefs)
    slugs = {href.removeprefix("/en/") for href in raw_hrefs}
    kept = sorted(slug for slug in slugs if _is_product_slug(slug))
    _log_discovery_breakdown("Lens", raw_hrefs, kept)
    return kept


async def discover_all_slugs() -> tuple[list[str], list[str]]:
    """Run both hub crawls concurrently. Returns (camera_slugs, lens_slugs)."""
    return await asyncio.gather(discover_camera_slugs(), discover_lens_slugs())


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

    Two page shapes exist here, verified live. `DEFAULT_VERSUS_LENS_SLUGS`
    in main.py (curated before standalone lens coverage was found) is built
    entirely from "camera + lens" kit pages, where `display_name` is "Camera
    Name + Lens Name" and only the lens half is used; weight and release
    date on a kit page are the *camera's* figures (verified: identical to
    the camera's solo page), so they're deliberately left unmapped rather
    than mis-attributed to the lens. But kit pages are not the only shape:
    Fujifilm's GF (medium format) lenses were the first confirmed standalone
    exception, and `discover_lens_slugs` (this module) has since found many
    more — real standalone lens pages across Sony E, Canon EF/RF, Nikon Z,
    Sigma, and others (e.g. "sony-fe-24-70mm-f-2-8-gm-ii"), where
    `display_name` is just the lens's own name with no " + " delimiter —
    detected here via `is_kit_page`. On a standalone page there's no camera
    to conflate with, so weight and release date genuinely belong to the
    lens and are safe to map.
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


def _brands_in(slugs: list[str]) -> list[str]:
    return sorted(
        {prefix for prefix in KNOWN_BRAND_PREFIXES if any(slug.startswith(f"{prefix}-") for slug in slugs)}
    )


async def _run_discover(kind: str) -> None:
    if kind in ("camera", "all"):
        cameras = await discover_camera_slugs()
        brands = _brands_in(cameras)
        print(f"Discovered {len(cameras)} camera slug(s) across {len(brands)} brand(s): {brands}")
        for slug in cameras:
            print(f"  {slug}")
    if kind in ("lens", "all"):
        lenses = await discover_lens_slugs()
        brands = _brands_in(lenses)
        print(f"Discovered {len(lenses)} lens slug(s) across {len(brands)} brand(s): {brands}")
        for slug in lenses:
            print(f"  {slug}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape a Versus.com camera or lens page.")
    parser.add_argument("--type", choices=["camera", "lens"], default="camera")
    parser.add_argument("--slug", default=None, help="Versus product slug (default depends on --type)")
    parser.add_argument(
        "--discover",
        choices=["camera", "lens", "all"],
        default=None,
        help="Instead of scraping one page, crawl the versus.com category hub(s) and list every "
        "discovered product slug",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.discover:
        asyncio.run(_run_discover(args.discover))
    elif args.type == "camera":
        camera = asyncio.run(fetch_camera(args.slug or DEFAULT_CAMERA_SLUG))
        print(camera.model_dump_json(indent=2))
    else:
        lens = asyncio.run(fetch_lens(args.slug or DEFAULT_LENS_KIT_SLUG))
        print(lens.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
