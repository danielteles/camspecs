"""Test pipeline for the curated Wikidata-gap fallback overrides.

Run with `python -m tests.test_curated_fallbacks` from `scripts/scraper/`
(venv active). Feeds merged-shape records through
`apply_curated_sensor_format_overrides` / `apply_curated_lens_release_years`
and asserts: the three single-format mounts get a real sensor_format (and
so survive `drop_unmergeable_wikidata_cameras`), a mixed-format mount stays
untouched (and so still gets dropped), a curated lens-kit slug gets its
release_year filled in from `source_url`, and nothing already populated
gets clobbered.
"""

from __future__ import annotations

from pprint import pprint

from models import CameraSpecs, LensSpecs
from transformers.merger import (
    apply_curated_lens_release_years,
    apply_curated_sensor_format_overrides,
    drop_unmergeable_wikidata_cameras,
)

CAMERA_MFT_WIKIDATA_ONLY = {
    "brand": "OM System",
    "model": "OM-5",
    "mount": "Micro Four Thirds",
    "sensor_format": "other",
    "release_year": 2022,
    "source": "wikidata",
    "source_url": "https://www.wikidata.org/wiki/Q999101",
}

CAMERA_FUJIFILM_G_WIKIDATA_ONLY = {
    "brand": "Fujifilm",
    "model": "GFX100S",
    "mount": "Fujifilm G-mount",
    "sensor_format": "other",
    "release_year": 2021,
    "source": "wikidata",
    "source_url": "https://www.wikidata.org/wiki/Q999102",
}

CAMERA_FUJIFILM_X_WIKIDATA_ONLY = {
    "brand": "Fujifilm",
    "model": "X-T30 II",
    "mount": "Fujifilm X-mount",
    "sensor_format": "other",
    "release_year": 2021,
    "source": "wikidata",
    "source_url": "https://www.wikidata.org/wiki/Q999103",
}

# Sony E is a mixed-format mount (full-frame *and* APS-C bodies both exist)
# — must NOT be guessed at, and must still be dropped afterward.
CAMERA_MIXED_MOUNT_WIKIDATA_ONLY = {
    "brand": "Sony",
    "model": "Alpha 7C II",
    "mount": "Sony E-mount",
    "sensor_format": "other",
    "release_year": 2023,
    "source": "wikidata",
    "source_url": "https://www.wikidata.org/wiki/Q999104",
}

# Already has a real format from a higher-priority source — must be left
# alone even though its mount is one of the curated ones.
CAMERA_MFT_ALREADY_RESOLVED = {
    "brand": "Panasonic",
    "model": "Lumix G9 II",
    "mount": "Micro Four Thirds",
    "sensor_format": "micro-four-thirds",
    "source": "manufacturer:panasonic",
    "source_url": "https://www.panasonic.com/lumix-g9ii",
}

LENS_CURATED_KIT_GAP = {
    "brand": "Nikon",
    "model": "NIKKOR Z 40mm f/2 (SE)",
    "mount": "Nikon Z-mount",
    "min_focal_length_mm": 40,
    "max_focal_length_mm": 40,
    "min_aperture": 2,
    "max_aperture": 16,
    "release_year": None,
    "source": "versus",
    "source_url": "https://versus.com/en/nikon-zf-nikon-nikkor-z-40mm-f-2-se",
}

LENS_UNCURATED_SLUG = {
    "brand": "Sony",
    "model": "FE 24-70mm F2.8 GM II",
    "mount": "Sony E-mount",
    "min_focal_length_mm": 24,
    "max_focal_length_mm": 70,
    "min_aperture": 2.8,
    "max_aperture": 22,
    "release_year": None,
    "source": "versus",
    "source_url": "https://versus.com/en/sony-alpha-7-iv-sony-fe-24-70mm-f2-8-gm-ii",
}

LENS_ALREADY_HAS_YEAR = {
    "brand": "Canon",
    "model": "RF 24-105mm F4L IS USM",
    "mount": "Canon RF",
    "min_focal_length_mm": 24,
    "max_focal_length_mm": 105,
    "min_aperture": 4,
    "max_aperture": 32,
    "release_year": 2018,
    "source": "manufacturer:canon",
    "source_url": "https://versus.com/en/canon-eos-r5-canon-rf-24-105mm-f-4l-is-usm",
}


def main() -> None:
    print("=== Applying curated sensor_format overrides ===")
    cameras = [
        CameraSpecs.model_validate(CAMERA_MFT_WIKIDATA_ONLY),
        CameraSpecs.model_validate(CAMERA_FUJIFILM_G_WIKIDATA_ONLY),
        CameraSpecs.model_validate(CAMERA_FUJIFILM_X_WIKIDATA_ONLY),
        CameraSpecs.model_validate(CAMERA_MIXED_MOUNT_WIKIDATA_ONLY),
        CameraSpecs.model_validate(CAMERA_MFT_ALREADY_RESOLVED),
    ]
    cameras = apply_curated_sensor_format_overrides(cameras)
    for camera in cameras:
        pprint(camera.model_dump())
        print()

    by_slug = {camera.slug: camera for camera in cameras}
    assert by_slug["om-system-om-5-micro-four-thirds"].sensor_format == "micro-four-thirds", (
        "MFT mount must resolve to micro-four-thirds"
    )
    assert by_slug["fujifilm-gfx100s-fujifilm-g"].sensor_format == "medium-format", (
        "Fujifilm G-mount must resolve to medium-format"
    )
    assert by_slug["fujifilm-x-t30-ii-fujifilm-x"].sensor_format == "aps-c", (
        "Fujifilm X-mount must resolve to aps-c"
    )
    assert by_slug["sony-alpha-7c-ii-sony-e"].sensor_format == "other", (
        "mixed-format mount (Sony E) must NOT be guessed at"
    )
    assert by_slug["panasonic-lumix-g9-ii-micro-four-thirds"].sensor_format == "micro-four-thirds", (
        "a real, already-resolved sensor_format must be left untouched"
    )
    print("OK  sensor_format override assertions passed\n")

    print("=== Overrides must save real gear from the Wikidata-only drop filter ===")
    filtered = drop_unmergeable_wikidata_cameras(cameras)
    filtered_slugs = {camera.slug for camera in filtered}
    assert {
        "om-system-om-5-micro-four-thirds",
        "fujifilm-gfx100s-fujifilm-g",
        "fujifilm-x-t30-ii-fujifilm-x",
    } <= filtered_slugs, "the three curated-mount cameras must survive the drop filter"
    assert "sony-alpha-7c-ii-sony-e" not in filtered_slugs, (
        "the mixed-mount camera must still be dropped — its gap is real"
    )
    print("OK  drop-filter interaction assertions passed\n")

    print("=== Applying curated lens-kit release_year overrides ===")
    lenses = [
        LensSpecs.model_validate(LENS_CURATED_KIT_GAP),
        LensSpecs.model_validate(LENS_UNCURATED_SLUG),
        LensSpecs.model_validate(LENS_ALREADY_HAS_YEAR),
    ]
    lenses = apply_curated_lens_release_years(lenses)
    for lens in lenses:
        pprint(lens.model_dump())
        print()

    lens_by_slug = {lens.slug: lens for lens in lenses}
    assert lens_by_slug["nikon-nikkor-z-40mm-f-2-se-nikon-z"].release_year == 2022, (
        "a curated lens-kit slug must backfill its verified release_year"
    )
    assert lens_by_slug["sony-fe-24-70mm-f-2-8-gm-ii-sony-e"].release_year is None, (
        "a slug outside the curated dictionary must be left null, not guessed at"
    )
    assert lens_by_slug["canon-rf-24-105mm-f-4l-is-usm-canon-rf"].release_year == 2018, (
        "an already-populated release_year must not be overwritten"
    )
    print("OK  lens release_year override assertions passed")

    print("\nAll curated fallback scenarios validated successfully.")


if __name__ == "__main__":
    main()
