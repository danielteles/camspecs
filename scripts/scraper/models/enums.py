"""Enumerations and normalization helpers for controlled-vocabulary fields."""

from __future__ import annotations

from enum import Enum


class SensorFormat(str, Enum):
    FULL_FRAME = "full-frame"
    APS_C = "aps-c"
    MICRO_FOUR_THIRDS = "micro-four-thirds"
    MEDIUM_FORMAT = "medium-format"
    ONE_INCH = "1-inch"
    OTHER = "other"


_SENSOR_FORMAT_ALIASES: dict[str, SensorFormat] = {
    "full frame": SensorFormat.FULL_FRAME,
    "full-frame": SensorFormat.FULL_FRAME,
    "fullframe": SensorFormat.FULL_FRAME,
    "35mm": SensorFormat.FULL_FRAME,
    "35mm full frame": SensorFormat.FULL_FRAME,
    "aps-c": SensorFormat.APS_C,
    "apsc": SensorFormat.APS_C,
    "aps c": SensorFormat.APS_C,
    "four thirds": SensorFormat.MICRO_FOUR_THIRDS,
    "micro four thirds": SensorFormat.MICRO_FOUR_THIRDS,
    "micro-four-thirds": SensorFormat.MICRO_FOUR_THIRDS,
    "mft": SensorFormat.MICRO_FOUR_THIRDS,
    "m4/3": SensorFormat.MICRO_FOUR_THIRDS,
    "medium format": SensorFormat.MEDIUM_FORMAT,
    "medium-format": SensorFormat.MEDIUM_FORMAT,
    "1 inch": SensorFormat.ONE_INCH,
    "1-inch": SensorFormat.ONE_INCH,
    '1"': SensorFormat.ONE_INCH,
}


def normalize_sensor_format(value: str) -> SensorFormat:
    """Map a raw, free-text sensor format string onto a `SensorFormat` member.

    Unrecognized values fall back to `SensorFormat.OTHER` rather than raising,
    since source sites use inconsistent labels for the same physical format.
    """
    key = value.strip().lower()
    if key in _SENSOR_FORMAT_ALIASES:
        return _SENSOR_FORMAT_ALIASES[key]
    for member in SensorFormat:
        if member.value == key:
            return member
    return SensorFormat.OTHER
