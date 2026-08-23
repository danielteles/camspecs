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
    """Convert weight strings such as "658 g" or "1.2kg" into whole grams."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return round(float(value))
    text = str(value).strip()
    if not text:
        return None
    match = _WEIGHT_PATTERN.search(text.replace(",", "."))
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


def normalize_mount(value: str) -> str:
    """Normalize a mount name (e.g. "Sony E-mount") into a stable slug ("sony-e")."""
    text = re.sub(r"(?i)\bmount\b", "", value.strip()).strip()
    text = re.sub(r"[\s_/]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text.lower()


def slugify(value: str) -> str:
    """Turn a display string into a URL-safe, lowercase, hyphenated slug."""
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text
