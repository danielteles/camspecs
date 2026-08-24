"""Sanitization helpers for turning messy scraped strings into typed values."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

_NUMBER_PATTERN = re.compile(r"[-+]?\d*[.,]?\d+")
_WEIGHT_PATTERN = re.compile(r"([\d.,]+)\s*(kg|kilograms?|g|grams?)?", re.IGNORECASE)


def parse_float(value: Any) -> float | None:
    """Extract the first numeric value from a string like "24.2MP" or "f/2.8"."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    match = _NUMBER_PATTERN.search(text.replace(",", "."))
    if not match:
        return None
    return float(match.group())


def parse_weight_grams(value: Any) -> int | None:
    """Convert weight strings such as "658 g", "1.2kg", or "1,030 g" into whole grams."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value))
    text = str(value).strip()
    if not text:
        return None
    # A comma here is a thousands separator (Versus formats gram-scale
    # weights as e.g. "1,030 g" — verified live on the Fujifilm GFX100 II
    # page), never a decimal point: no camera or lens weighs a fractional
    # gram. Stripping it outright, rather than converting it to "." the way
    # parse_float does for genuinely decimal-comma fields like crop_factor,
    # is what keeps "1,030 g" from being misread as 1.03g.
    match = _WEIGHT_PATTERN.search(text.replace(",", ""))
    if not match:
        return None
    amount = float(match.group(1))
    unit = (match.group(2) or "g").lower()
    if unit.startswith("kg") or unit.startswith("kilogram"):
        amount *= 1000
    return round(amount)


def parse_crop_factor(value: Any) -> float | None:
    """Convert crop factor strings such as "1.5x" or "1,5" into a float."""
    if value is None:
        return None
    text = str(value).strip().lower().rstrip("x").strip()
    return parse_float(text)


# L-mount is the one canonical MountId that keeps the literal word "mount"
# in its own slug ("l-mount") — every other supported mount's slug has
# "mount" stripped out entirely (sony-e, canon-rf, ...), so the generic
# strip-the-word-"mount" rule below is correct for those but actively wrong
# for this one: it turns an already-canonical "l-mount" into "l", and a
# scraped label like "Leica L-Mount" into "leica-l", neither of which match
# the app's actual MountId. Checked before the generic rule runs, keyed on a
# whitespace/hyphen-collapsed lowercase form so "l-mount", "L-Mount", and
# "Leica L-Mount" (all confirmed live: the first from Wikidata's QID-based
# resolution in extractors/wikidata.py, which is otherwise correct until
# this same generic rule reprocesses it; the second and third from
# extractors/versus.py's raw scraped mount text) all resolve the same way.
_MOUNT_ALIASES: dict[str, str] = {
    "l mount": "l-mount",
    "leica l mount": "l-mount",
}
_MOUNT_ALIAS_KEY_PATTERN = re.compile(r"[\s_-]+")


def normalize_mount(value: str | None) -> str | None:
    """Normalize a mount name (e.g. "Sony E-mount") into a stable slug ("sony-e").

    `None` passes through unchanged rather than raising. A missing mount is a
    real, common outcome (fixed-lens cameras have no interchangeable mount at
    all, and some Versus pages omit the spec row even for genuine
    interchangeable-lens bodies — see `extractors/curated_fallbacks.py`'s
    `VERSUS_SLUG_MOUNT_OVERRIDES`), not a malformed-input error the caller
    should have prevented.
    """
    if value is None:
        return None
    alias_key = _MOUNT_ALIAS_KEY_PATTERN.sub(" ", value.strip().lower()).strip()
    if alias_key in _MOUNT_ALIASES:
        return _MOUNT_ALIASES[alias_key]
    text = re.sub(r"(?i)\bmount\b", "", value.strip()).strip()
    text = re.sub(r"[\s_/]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text.lower()


# Corporate-entity suffixes a manufacturer label sometimes carries instead
# of the plain product-facing brand name (Wikidata's manufacturerLabel is
# the biggest source of this — see extractors/wikidata.py's own
# _normalize_manufacturer_label, which handles the same problem at the
# point Wikidata data enters the pipeline). Applying the same rule here too
# is deliberate redundancy, not duplication-for-its-own-sake: this
# validator is the last line of defense for every source, not just
# Wikidata, so a future source that forgets to normalize still can't leak
# "Sony Group" or "Canon Inc." into a stored record. Ordered longest-first
# within the alternation so a compound suffix ("Holdings Corporation")
# isn't left partially stripped by a shorter alternative matching first.
_BRAND_CORPORATE_SUFFIX_PATTERN = re.compile(
    r"\s+(holdings corporation|corporation|group|co\.,?\s*ltd\.?|ltd\.?|inc\.?)\s*$",
    re.IGNORECASE,
)

# Known brand-text spelling variants that a corporate-suffix strip can't
# fix, keyed on a whitespace/hyphen-collapsed lowercase form (same
# technique as _MOUNT_ALIASES above). All three confirmed live on
# versus.com: camera pages spell it "OM System" (two words), lens pages
# hyphenate it "OM-System", and extractors/versus.py's _split_brand_model
# used to mis-split the two-word camera form into brand="OM" before that
# was fixed at the source — this alias map is what canonicalizes
# already-mis-split historical data (and any other client that hasn't been
# updated) rather than just preventing new instances. "FujiFilm" is a
# confirmed live case-variant on one specific Versus lens page's own
# display text, not a systematic issue — canonicalized the same way.
_BRAND_ALIASES: dict[str, str] = {
    "om system": "OM System",
    "om": "OM System",
    "fujifilm": "Fujifilm",
}
_BRAND_ALIAS_KEY_PATTERN = re.compile(r"[\s_-]+")


def normalize_brand(value: str) -> str:
    """Canonicalize a brand name against known source-side spelling/entity variants.

    Alias lookup runs first since it's the only thing that can fix "OM" ->
    "OM System" (there's no corporate suffix to strip) or a pure casing
    difference; corporate-suffix stripping is the fallback for anything not
    already covered by the alias map.
    """
    key = _BRAND_ALIAS_KEY_PATTERN.sub(" ", value.strip().lower()).strip()
    if key in _BRAND_ALIASES:
        return _BRAND_ALIASES[key]
    stripped = _BRAND_CORPORATE_SUFFIX_PATTERN.sub("", value.strip()).strip()
    return stripped or value.strip()


def strip_redundant_brand_prefix(brand: str, model: str) -> str:
    """Strip a leading repeat of `brand` from `model` ("Canon EOS R10" -> "EOS R10").

    Mirrors extractors/wikidata.py's own `_strip_brand_prefix` (which already
    does this for a fresh Wikidata fetch, keyed off the *normalized* brand),
    but applied here as a schema-level backstop so it also self-heals
    already-stored data from before that ordering was correct, and covers
    every source, not just Wikidata — confirmed live as a widespread
    historical issue (21 camera rows, 26 lens rows in one production
    catalog), not a one-off.
    """
    prefix = f"{brand} "
    if model.lower().startswith(prefix.lower()):
        return model[len(prefix) :].strip()
    return model


# Versus writes an f-stop embedded in a lens model name as "f/5.6" (lowercase,
# with the slash); Wikidata's labels write the same fact as "F5.6" (uppercase,
# no slash) — confirmed live as the cause of 66 lens records and 1 camera
# record duplicating in one production catalog, since `merge_key`
# (transformers/merger.py) strips all punctuation and treats both spellings
# as identical, but `slugify` below hyphenates around a "/" that "F5.6" never
# had — so the same physical lens, fetched from both sources in separate
# pipeline runs, gets two different slugs and two different upserted rows
# instead of merging into one. Canonicalizing to Versus's "f/" form before
# slug generation keeps the two sources from ever diverging on this again.
_APERTURE_NOTATION_PATTERN = re.compile(r"\bF/?(?=\d)", re.IGNORECASE)


def normalize_lens_model_text(model: str) -> str:
    """Canonicalize embedded f-stop notation in a lens model name to "f/N"."""
    return _APERTURE_NOTATION_PATTERN.sub("f/", model)


def slugify(value: str) -> str:
    """Turn a display string into a URL-safe, lowercase, hyphenated slug."""
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text
