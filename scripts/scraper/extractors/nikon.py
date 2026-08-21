"""Playwright scraper for Nikon USA's official camera specification pages.

Sony, Canon, and Panasonic's product pages all return HTTP 403 ("Access
Denied") from this environment's outbound IP — a WAF/bot-detection block, not
a selector problem. Nikon USA's pages responded normally and turned out to
have unusually clean, consistently labeled markup, so it's the live target
for this step. The extraction approach (label/value pairs keyed by a CSS
class containing "title") is generic enough to retarget at another
manufacturer's page later without a rewrite, if their markup follows a
similar convention.

Run as a CLI with `python -m extractors.nikon [--url URL]` from
`scripts/scraper/` (venv active).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import re

from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError, async_playwright
from pydantic import ValidationError

from models import CameraSpecs

logger = logging.getLogger(__name__)

DEFAULT_URL = "https://www.nikonusa.com/p/z6iii/1890/overview"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
NAV_TIMEOUT_MS = 30_000
MAX_ATTEMPTS = 2

TECH_SPECS_TAB_SELECTOR = "#product-overview-tabs-tab-tech-specs"
TECH_SPECS_PANEL_SELECTOR = "#product-overview-tabs-tabpane-tech-specs"

# The tech-specs panel mixes two different component layouts (an "at a
# glance" summary and a "full specs" accordion), but both label their spec
# name with a CSS-module class containing "title" and put the value in the
# rest of the <li>'s text — so a single generic selector covers both.
_SPEC_PAIRS_JS = """
els => els.map(li => {
    const title = li.querySelector('[class*="itle"]');
    if (!title) return null;
    const titleText = title.textContent.trim();
    const fullText = li.textContent.trim();
    const valueText = fullText.startsWith(titleText)
        ? fullText.slice(titleText.length).trim()
        : fullText;
    return [titleText, valueText];
}).filter(Boolean)
"""

# Nikon's own sensor-format jargon ("FX" = full-frame, "DX" = APS-C-ish
# "Nikon DX", "CX" = 1-inch) doesn't match the generic English terms our
# SensorFormat normalizer recognizes, so it's translated here first.
_NIKON_SENSOR_FORMAT_MAP = {
    "FX": "full-frame",
    "DX": "aps-c",
    "CX": "1-inch",
}

_SENSOR_SIZE_PATTERN = re.compile(r"([\d.]+)\s*mm\s*x\s*([\d.]+)\s*mm", re.IGNORECASE)
_WEIGHT_GRAMS_PATTERN = re.compile(r"\(\s*([\d.]+)\s*g\s*\)", re.IGNORECASE)
_PARENTHETICAL_PATTERN = re.compile(r"\(([^)]+)\)")


def _parse_sensor_size(text: str | None) -> dict[str, float] | None:
    if not text:
        return None
    match = _SENSOR_SIZE_PATTERN.search(text)
    if not match:
        return None
    # Nikon's own pages are inconsistent about which dimension comes first
    # (the Z6III page lists "35.9 mm x 23.9 mm", width-first, while the
    # Z50II page lists "15.7 mm x 23.5 mm", height-first) with no explicit
    # "Width:"/"Height:" label either way. No interchangeable-lens camera
    # has a portrait-oriented sensor, so the larger value is always width.
    a, b = float(match.group(1)), float(match.group(2))
    return {"width_mm": max(a, b), "height_mm": min(a, b)}


def _parse_weight_grams(text: str | None) -> int | None:
    if not text:
        return None
    # Nikon lists weight as "23.7 oz. (670 g)" — the naive first-number parse
    # in models.parsers would grab the ounce figure, so grams are pulled from
    # the parenthetical explicitly instead.
    match = _WEIGHT_GRAMS_PATTERN.search(text)
    if not match:
        return None
    return round(float(match.group(1)))


def _map_sensor_format(text: str | None) -> str:
    if not text:
        return "other"
    return _NIKON_SENSOR_FORMAT_MAP.get(text.strip().upper(), text)


def _parse_video_formats(text: str | None) -> list[str]:
    if not text:
        return []
    labels = _PARENTHETICAL_PATTERN.findall(text)
    # Dedupe while preserving order (the field mixes several similar labels).
    seen: set[str] = set()
    formats: list[str] = []
    for label in labels:
        label = label.strip()
        if label and label not in seen:
            seen.add(label)
            formats.append(label)
    return formats


async def _extract_spec_pairs(page: Page) -> dict[str, str]:
    try:
        await page.click(TECH_SPECS_TAB_SELECTOR, timeout=NAV_TIMEOUT_MS)
    except PlaywrightTimeoutError:
        logger.warning("Tech specs tab not found — page layout may have changed")
        return {}

    try:
        panel = await page.wait_for_selector(TECH_SPECS_PANEL_SELECTOR, timeout=NAV_TIMEOUT_MS)
    except PlaywrightTimeoutError:
        logger.warning("Tech specs panel not found after clicking tab")
        return {}

    pairs = await panel.eval_on_selector_all("li", _SPEC_PAIRS_JS)
    # Later entries win: the panel repeats a few fields (e.g. "Effective
    # Pixels") between the glance summary and full accordion with identical
    # values, so overwriting is harmless.
    return dict(pairs)


async def _get_model_name(page: Page) -> str | None:
    try:
        h1 = await page.wait_for_selector("h1", timeout=NAV_TIMEOUT_MS)
    except PlaywrightTimeoutError:
        return None
    text = await h1.inner_text()
    return text.strip() or None


async def scrape_camera(page: Page, url: str) -> dict:
    """Navigate to a Nikon USA product page and extract a raw CameraSpecs dict.

    Missing fields fall back to None rather than raising, so a page-layout
    change degrades to a validation error on the required fields instead of
    an unhandled crash mid-scrape.
    """
    await page.goto(url, timeout=NAV_TIMEOUT_MS, wait_until="domcontentloaded")

    model = await _get_model_name(page)
    specs = await _extract_spec_pairs(page)

    return {
        "brand": "Nikon",
        "model": model,
        "mount": specs.get("Lens Mount"),
        "sensor_format": _map_sensor_format(specs.get("Image Sensor Format")),
        "sensor": _parse_sensor_size(specs.get("Sensor Size")),
        "megapixels": specs.get("Effective Pixels"),
        "weight_g": _parse_weight_grams(specs.get("Approx. Weight")),
        "video_formats": _parse_video_formats(specs.get("Movie")),
        "source": "manufacturer:nikon",
        "source_url": url,
    }


async def fetch_camera(url: str = DEFAULT_URL) -> CameraSpecs:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                try:
                    context = await browser.new_context(
                        user_agent=USER_AGENT, viewport={"width": 1366, "height": 900}
                    )
                    page = await context.new_page()
                    raw = await scrape_camera(page, url)
                finally:
                    await browser.close()
            return CameraSpecs.model_validate(raw)
        except (PlaywrightTimeoutError, ValidationError) as exc:
            last_exc = exc
            logger.warning("Scrape attempt %d/%d failed: %s", attempt, MAX_ATTEMPTS, exc)
    raise RuntimeError(f"Failed to scrape {url} after {MAX_ATTEMPTS} attempts") from last_exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape a Nikon USA camera specification page.")
    parser.add_argument("--url", default=DEFAULT_URL, help="Nikon USA product page URL")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    camera = asyncio.run(fetch_camera(args.url))
    print(camera.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
