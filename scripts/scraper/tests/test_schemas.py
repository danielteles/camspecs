"""Mock data validator script for CameraSpecs and LensSpecs.

Run with `python -m tests.test_schemas` from `scripts/scraper/` (venv active).
Feeds intentionally messy, realistic raw dicts through the Pydantic v2 models
to confirm sanitization (weights, focal lengths, crop factors, enums) and
error handling both work as expected.
"""

from __future__ import annotations

from pprint import pprint

from pydantic import ValidationError

from models import CameraSpecs, LensSpecs

MOCK_CAMERAS = [
    {
        "brand": "Sony",
        "model": "Alpha 7 IV",
        "mount": "Sony E-mount",
        "sensor_format": "Full-frame",
        "sensor": {"width_mm": 35.7, "height_mm": 23.8},
        "megapixels": "33 MP",
        "release_year": 2021,
        "weight_g": "658 g",
        "crop_factor": "1.0x",
        "video_formats": "4K60p, 4K30p, FHD120p",
        "source": "manufacturer:sony",
        "source_url": "https://www.sony.com/electronics/interchangeable-lens-cameras/ilce-7m4",
    },
    {
        "brand": "Fujifilm",
        "model": "X-T5",
        "mount": "Fujifilm X",
        "sensor_format": "APS-C",
        "megapixels": 40.2,
        "release_year": 2022,
        "weight_g": "557g",
        "crop_factor": "1,5x",
        "source": "wikidata",
    },
]

MOCK_LENSES = [
    {
        "brand": "Canon",
        "model": "RF 24-70mm F2.8L IS USM",
        "mount": "Canon RF",
        "min_focal_length_mm": "24mm",
        "max_focal_length_mm": "70mm",
        "min_aperture": "f/2.8",
        "max_aperture": "f/22",
        "weight_g": "900 g",
        "release_year": 2019,
        "source": "manufacturer:canon",
    },
    {
        "brand": "Nikon",
        "model": "Z 50mm f/1.8 S",
        "mount": "Nikon Z-mount",
        "min_focal_length_mm": "50",
        "max_focal_length_mm": "50",
        "min_aperture": "1.8",
        "max_aperture": "16",
        "weight_g": 415,
        "source": "wikidata",
    },
]

# Invalid on purpose: 1500 predates photography, so it must fail range validation.
INVALID_CAMERA = {
    "brand": "Acme",
    "model": "Time Machine 1",
    "mount": "Unknown",
    "sensor_format": "full-frame",
    "release_year": 1500,
    "source": "mock",
}


def main() -> None:
    print("=== Validating mock CameraSpecs ===")
    for raw in MOCK_CAMERAS:
        camera = CameraSpecs.model_validate(raw)
        print(f"OK  {camera.brand} {camera.model} -> slug={camera.slug!r}")
        pprint(camera.model_dump())
        print()

    print("=== Validating mock LensSpecs ===")
    for raw in MOCK_LENSES:
        lens = LensSpecs.model_validate(raw)
        print(f"OK  {lens.brand} {lens.model} -> slug={lens.slug!r} is_prime={lens.is_prime}")
        pprint(lens.model_dump())
        print()

    print("=== Verifying invalid data is rejected ===")
    try:
        CameraSpecs.model_validate(INVALID_CAMERA)
    except ValidationError as exc:
        print(f"OK  invalid camera correctly rejected: {exc.error_count()} error(s)")
    else:
        raise AssertionError("Expected INVALID_CAMERA to fail validation")

    print("\nAll mock records validated successfully.")


if __name__ == "__main__":
    main()
