"""Pydantic schema for normalized lens specifications."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from .parsers import normalize_mount, parse_float, parse_weight_grams, slugify


class LensSpecs(BaseModel):
    """Normalized, validated specification record for a single lens."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    slug: str | None = None
    brand: str
    model: str
    # Optional for the same reason as CameraSpecs.mount (see models/camera.py)
    # — some Versus lens pages omit the spec row even for a real
    # interchangeable-lens product.
    mount: str | None = None
    min_focal_length_mm: float = Field(gt=0)
    max_focal_length_mm: float = Field(gt=0)
    min_aperture: float = Field(gt=0)
    max_aperture: float = Field(gt=0)
    weight_g: int | None = Field(default=None, gt=0)
    is_prime: bool | None = None
    release_year: int | None = Field(default=None, ge=1826, le=2100)

    source: str
    source_url: HttpUrl | None = None
    scraped_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("mount", mode="before")
    @classmethod
    def _normalize_mount(cls, value: str | None) -> str | None:
        return normalize_mount(value)

    @field_validator(
        "min_focal_length_mm", "max_focal_length_mm", "min_aperture", "max_aperture",
        mode="before",
    )
    @classmethod
    def _parse_numeric(cls, value: object) -> float | None:
        return parse_float(value)

    @field_validator("weight_g", mode="before")
    @classmethod
    def _parse_weight(cls, value: object) -> int | None:
        return parse_weight_grams(value)

    @model_validator(mode="after")
    def _apply_defaults(self) -> "LensSpecs":
        if not self.slug:
            # See CameraSpecs._apply_defaults (models/camera.py) for why
            # mount has to be part of the slug: the same third-party lens is
            # commonly sold under identical brand+model text across several
            # mounts (e.g. a Sigma "85mm F1.4 DG HSM Art" in both Canon EF
            # and Nikon F versions), which `merge_key` already treats as
            # distinct products — the DB identity needs to agree, or two
            # such records collide on `slug` and crash the upsert batch.
            base = f"{self.brand}-{self.model}-{self.mount}" if self.mount else f"{self.brand}-{self.model}"
            self.slug = slugify(base)
        if self.is_prime is None:
            self.is_prime = self.min_focal_length_mm == self.max_focal_length_mm
        if self.max_focal_length_mm < self.min_focal_length_mm:
            raise ValueError("max_focal_length_mm must be >= min_focal_length_mm")
        return self
