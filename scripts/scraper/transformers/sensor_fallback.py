"""Fallback sensor-dimension lookup for standard formats.

Wikidata has no populated sensor-dimension property (see
`extractors/wikidata.py`'s note on `sensor_format`) and Versus.com's spec
tables don't expose width/height in mm either — only a manufacturer's own
page reliably does (see `extractors/nikon.py`'s "Sensor Size" parse). Most
mirrorless systems build on a handful of physically standardized sensor
sizes, though, so once a merged record has a *format* (full-frame, aps-c,
...) but ended up with no exact mm dimensions from any source, the
well-known figure for that format is a safe stand-in — safer than leaving
the frontend's `sensor.widthMm`/`heightMm` requirement unmet and dropping an
otherwise-complete record (see `lib/services/equipment.ts`'s `toCamera`).

Canon's APS-C sensor (22.3 x 14.9mm) is physically smaller than every other
manufacturer's APS-C sensor (23.5 x 15.6mm — Sony, Nikon, Fujifilm, Pentax
all share it), so APS-C needs a brand-specific lookup rather than one shared
constant; using the wrong one would skew crop-factor and field-of-view
figures in `lib/equivalence.ts` by close to 5%. Every other standard format
here only has one real-world size across current mirrorless production, so
brand doesn't matter for those.

`SensorFormat.ONE_INCH` and `SensorFormat.OTHER` are deliberately not in the
lookup: 1-inch compacts aren't part of this site's interchangeable-lens
catalog and "other" isn't a real physical size to standardize on. Both also
fall outside the frontend's accepted `SensorFormat` union
(`lib/services/equipment.ts`'s `SENSOR_FORMATS`), so a record stuck at
either format is filtered out downstream regardless of whether `sensor` gets
filled in here.
"""

from __future__ import annotations

from models.camera import CameraSpecs, SensorDimensions
from models.enums import SensorFormat

_APS_C_DEFAULT_MM = (23.5, 15.6)  # Sony / Nikon / Fujifilm / Pentax APS-C
_CANON_APS_C_MM = (22.3, 14.9)  # Canon APS-C is physically smaller

_STANDARD_DIMENSIONS_MM: dict[SensorFormat, tuple[float, float]] = {
    SensorFormat.FULL_FRAME: (36.0, 24.0),
    SensorFormat.MICRO_FOUR_THIRDS: (17.3, 13.0),
    # Common "44x33" digital medium-format sensor (Fujifilm GFX, Hasselblad X)
    SensorFormat.MEDIUM_FORMAT: (43.8, 32.9),
}


def _default_dimensions_mm(sensor_format: SensorFormat, brand: str) -> tuple[float, float] | None:
    if sensor_format == SensorFormat.APS_C:
        return _CANON_APS_C_MM if brand.strip().lower() == "canon" else _APS_C_DEFAULT_MM
    return _STANDARD_DIMENSIONS_MM.get(sensor_format)


def backfill_sensor_dimensions(cameras: list[CameraSpecs]) -> list[CameraSpecs]:
    """Fill in `sensor` from known standard-format mm sizes where still null.

    Mutates and returns the same records (mirrors `merge_records`'
    fetch -> merge -> validate pipeline shape) — only touches records where
    every source left `sensor` null but a source did resolve a concrete,
    standardized `sensor_format`.
    """
    for camera in cameras:
        if camera.sensor is not None:
            continue
        dims = _default_dimensions_mm(camera.sensor_format, camera.brand)
        if dims is None:
            continue
        width_mm, height_mm = dims
        camera.sensor = SensorDimensions(width_mm=width_mm, height_mm=height_mm)
    return cameras
