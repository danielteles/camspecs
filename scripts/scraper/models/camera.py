"""Pydantic schema for normalized camera body specifications."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from .enums import SensorFormat, normalize_sensor_format
from .parsers import normalize_mount, parse_crop_factor, parse_float, parse_weight_grams, slugify


class SensorDimensions(BaseModel):
    model_config = ConfigDict(frozen=True)

    width_mm: float = Field(gt=0)
    height_mm: float = Field(gt=0)


class CameraSpecs(BaseModel):
    """Normalized, validated specification record for a single camera body."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    slug: str | None = None
    brand: str
    model: str
    # Optional rather than required: a fixed-lens camera genuinely has none,
    # and some Versus pages omit the spec row even for a real
    # interchangeable-lens body (see `extractors/curated_fallbacks.py`'s
    # VERSUS_SLUG_MOUNT_OVERRIDES). Either way a missing mount is real data,
    # not a malformed record — `main.py`'s `_drop_unsupported_mounts` is what
    # actually excludes a still-null mount from the final catalog, after
    # `transformers/merger.py`'s `apply_curated_mount_overrides` and
    # cross-source backfill both get a chance to resolve it.
    mount: str | None = None
    sensor_format: SensorFormat
    sensor: SensorDimensions | None = None
    megapixels: float | None = Field(default=None, gt=0)
    release_year: int | None = Field(default=None, ge=1826, le=2100)
    weight_g: int | None = Field(default=None, gt=0)
    crop_factor: float | None = Field(default=None, gt=0)
    video_formats: list[str] = Field(default_factory=list)

    source: str
    source_url: HttpUrl | None = None
    scraped_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("mount", mode="before")
    @classmethod
    def _normalize_mount(cls, value: str | None) -> str | None:
        return normalize_mount(value)

    @field_validator("sensor_format", mode="before")
    @classmethod
    def _normalize_sensor_format(cls, value: object) -> SensorFormat:
        if isinstance(value, SensorFormat):
            return value
        return normalize_sensor_format(str(value))

    @field_validator("megapixels", mode="before")
    @classmethod
    def _parse_megapixels(cls, value: object) -> float | None:
        return parse_float(value)

    @field_validator("weight_g", mode="before")
    @classmethod
    def _parse_weight(cls, value: object) -> int | None:
        return parse_weight_grams(value)

    @field_validator("crop_factor", mode="before")
    @classmethod
    def _parse_crop_factor(cls, value: object) -> float | None:
        return parse_crop_factor(value)

    @field_validator("video_formats", mode="before")
    @classmethod
    def _normalize_video_formats(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return [str(item).strip() for item in value if str(item).strip()]  # type: ignore[union-attr]

    @model_validator(mode="after")
    def _apply_defaults(self) -> "CameraSpecs":
        if not self.slug:
            self.slug = slugify(f"{self.brand}-{self.model}")
        return self
