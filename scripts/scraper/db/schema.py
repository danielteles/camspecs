"""SQLAlchemy ORM models for the `cameras` and `lenses` tables.

Column names mirror the snake_case equivalents of `lib/types.ts`'s Camera /
Lens interfaces (slug, brand, model, mount, sensorFormat, sensor.widthMm/
heightMm, megapixels, releaseYear, minFocalLengthMm, ...) plus the scraper's
provenance fields (source, source_url, scraped_at) that the frontend doesn't
need but the pipeline does.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, Integer, Numeric, String, func
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class CameraRecord(Base):
    __tablename__ = "cameras"

    slug: Mapped[str] = mapped_column(String, primary_key=True)
    brand: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    mount: Mapped[str] = mapped_column(String, nullable=False)
    sensor_format: Mapped[str] = mapped_column(String, nullable=False)
    sensor_width_mm: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    sensor_height_mm: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    megapixels: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_g: Mapped[int | None] = mapped_column(Integer, nullable=True)
    crop_factor: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    video_formats: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    source: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class LensRecord(Base):
    __tablename__ = "lenses"

    slug: Mapped[str] = mapped_column(String, primary_key=True)
    brand: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    mount: Mapped[str] = mapped_column(String, nullable=False)
    min_focal_length_mm: Mapped[float] = mapped_column(Numeric, nullable=False)
    max_focal_length_mm: Mapped[float] = mapped_column(Numeric, nullable=False)
    min_aperture: Mapped[float] = mapped_column(Numeric, nullable=False)
    max_aperture: Mapped[float] = mapped_column(Numeric, nullable=False)
    weight_g: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_prime: Mapped[bool] = mapped_column(Boolean, nullable=False)
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


async def create_all(engine: AsyncEngine) -> None:
    """Create tables if they don't exist yet.

    A stand-in for real migrations (Alembic, etc.), which this project
    doesn't have set up — fine for local dev and for this pipeline, which
    only ever adds nullable/optional columns to a stable core shape.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
