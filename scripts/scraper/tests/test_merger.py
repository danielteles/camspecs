"""Test pipeline for the multi-source merger.

Run with `python -m tests.test_merger` from `scripts/scraper/` (venv active).
Feeds two intentionally conflicting/complementary mock sources per entity
through `merge_records` and asserts the merged result is deduplicated,
manufacturer-prioritized, and fully backfilled.
"""

from __future__ import annotations

from pprint import pprint

from models import CameraSpecs, LensSpecs
from transformers.merger import merge_records

# --- Cameras: manufacturer + Wikidata records for the *same* physical
# camera, deliberately formatted differently ("Z6III" vs "Z6 III") and with
# a conflicting weight, plus one unrelated single-source camera. ---

CAMERA_MANUFACTURER = {
    "brand": "Nikon",
    "model": "Z6III",
    "mount": "Nikon Z-mount",
    "sensor_format": "full-frame",
    "sensor": {"width_mm": 35.9, "height_mm": 23.9},
    "megapixels": 24.5,
    "weight_g": 670,
    "video_formats": ["5.4K", "4K UHD"],
    "source": "manufacturer:nikon",
    "source_url": "https://www.nikonusa.com/p/z6iii/1890/overview",
}

CAMERA_WIKIDATA = {
    "brand": "Nikon",
    "model": "Z6 III",  # differently spaced/cased than the manufacturer record
    "mount": "Nikon Z-mount",
    "sensor_format": "other",  # Wikidata's known sensor-format coverage gap
    "weight_g": "671 g",  # conflicts with the manufacturer's 670g — manufacturer must win
    "release_year": 2024,  # manufacturer page didn't have this — must be backfilled
    "source": "wikidata",
    "source_url": "https://www.wikidata.org/wiki/Q999001",
}

CAMERA_UNRELATED = {
    "brand": "Canon",
    "model": "EOS R50",
    "mount": "Canon RF",
    "sensor_format": "aps-c",
    "release_year": 2023,
    "source": "wikidata",
    "source_url": "https://www.wikidata.org/wiki/Q999002",
}

# --- A three-source case (manufacturer + Versus.com + Wikidata) for the
# same physical camera, exercising the full priority chain: Official
# Manufacturer > Versus.com > Wikidata. Deliberately listed out of priority
# order below to prove the merge sorts by priority rather than trusting
# input order. ---

PANASONIC_MANUFACTURER = {
    "brand": "Panasonic",
    "model": "Lumix S5 II",
    "mount": "L-Mount",
    "sensor_format": "full-frame",
    "megapixels": 24.2,
    "weight_g": 740,  # authoritative; Versus's conflicting 739g must lose
    "source": "manufacturer:panasonic",
    "source_url": "https://www.panasonic.com/lumix-s5-ii",
}

PANASONIC_VERSUS = {
    "brand": "Panasonic",
    "model": "Lumix S5 II",
    "mount": "L-Mount",
    "sensor_format": "full-frame",
    "weight_g": 739,  # conflicts with manufacturer — manufacturer must win
    "release_year": 2023,  # correct; must win over Wikidata's conflicting 2022
    "video_formats": ["5.9K", "4K60p"],  # must win over Wikidata's conflicting list
    "source": "versus",
    "source_url": "https://versus.com/en/panasonic-lumix-s5-ii",
}

PANASONIC_WIKIDATA = {
    "brand": "Panasonic",
    "model": "Lumix S5 II",
    "mount": "L-Mount",
    "sensor_format": "other",  # must lose to manufacturer's "full-frame"
    "release_year": 2022,  # must lose to Versus's 2023 (Versus outranks Wikidata)
    "video_formats": ["4K"],  # must lose to Versus's list
    "crop_factor": 1.0,  # neither other source has this — must still backfill
    "source": "wikidata",
    "source_url": "https://www.wikidata.org/wiki/Q999004",
}

# --- Lenses: same idea, with an en-dash vs hyphen difference in the model
# name on top of the casing difference. ---

LENS_MANUFACTURER = {
    "brand": "Sony",
    "model": "FE 24-70mm F2.8 GM II",
    "mount": "Sony E-mount",
    "min_focal_length_mm": 24,
    "max_focal_length_mm": 70,
    "min_aperture": 2.8,
    "max_aperture": 22,
    "weight_g": 695,
    "source": "manufacturer:sony",
    "source_url": "https://www.sony.com/electronics/camera-lenses/sel2470gm2",
}

LENS_WIKIDATA = {
    "brand": "Sony",
    "model": "FE 24–70mm F2.8 GM II",  # en-dash instead of hyphen
    "mount": "Sony E-mount",
    "min_focal_length_mm": 24,
    "max_focal_length_mm": 70,
    "min_aperture": 2.8,
    "max_aperture": 22,
    "weight_g": 700,  # conflicts with manufacturer's 695g
    "release_year": 2022,  # backfilled
    "source": "wikidata",
    "source_url": "https://www.wikidata.org/wiki/Q999003",
}


def main() -> None:
    print("=== Merging cameras ===")
    raw_cameras = [
        CameraSpecs.model_validate(CAMERA_MANUFACTURER),
        CameraSpecs.model_validate(CAMERA_WIKIDATA),
        CameraSpecs.model_validate(CAMERA_UNRELATED),
    ]
    print(f"Input: {len(raw_cameras)} records across "
          f"{len({(c.brand, c.model) for c in raw_cameras})} distinct (brand, model) pairs")

    merged_cameras = merge_records(raw_cameras)
    print(f"Output: {len(merged_cameras)} merged records\n")
    for camera in merged_cameras:
        pprint(camera.model_dump())
        print()

    z6iii = next(c for c in merged_cameras if c.slug == "nikon-z6iii")
    assert len(merged_cameras) == 2, "expected the two Z6III records to merge into one"
    assert z6iii.weight_g == 670, "manufacturer weight must win over Wikidata's conflicting value"
    assert z6iii.release_year == 2024, "release_year must be backfilled from Wikidata"
    assert z6iii.sensor_format == "full-frame", "manufacturer sensor_format must win"
    assert z6iii.source == "manufacturer:nikon+wikidata", "merged source must list both contributors"
    r50 = next(c for c in merged_cameras if c.slug == "canon-eos-r50")
    assert r50.source == "wikidata", "unrelated single-source camera must pass through unchanged"
    print("OK  camera merge assertions passed\n")

    print("=== Merging cameras across three sources (priority chain) ===")
    # Listed Wikidata-first, Manufacturer-last to prove the merge sorts by
    # priority rather than by input order.
    raw_panasonic = [
        CameraSpecs.model_validate(PANASONIC_WIKIDATA),
        CameraSpecs.model_validate(PANASONIC_VERSUS),
        CameraSpecs.model_validate(PANASONIC_MANUFACTURER),
    ]
    merged_panasonic = merge_records(raw_panasonic)
    assert len(merged_panasonic) == 1, "all three records must dedupe into one camera"
    s5ii = merged_panasonic[0]
    pprint(s5ii.model_dump())
    print()

    assert s5ii.weight_g == 740, "manufacturer weight must win over both Versus and Wikidata"
    assert s5ii.sensor_format == "full-frame", "manufacturer sensor_format must win over Wikidata"
    assert s5ii.release_year == 2023, "Versus's release_year must win over Wikidata's conflicting value"
    assert s5ii.video_formats == ["5.9K", "4K60p"], "Versus's video_formats must win over Wikidata's"
    assert s5ii.crop_factor == 1.0, "Wikidata must still backfill a field neither other source has"
    assert s5ii.source == "manufacturer:panasonic+versus+wikidata", (
        "merged source must list all three contributors, in priority order"
    )
    print("OK  three-source priority chain assertions passed\n")

    print("=== Merging lenses ===")
    raw_lenses = [
        LensSpecs.model_validate(LENS_MANUFACTURER),
        LensSpecs.model_validate(LENS_WIKIDATA),
    ]
    merged_lenses = merge_records(raw_lenses)
    print(f"Output: {len(merged_lenses)} merged record(s)\n")
    for lens in merged_lenses:
        pprint(lens.model_dump())
        print()

    assert len(merged_lenses) == 1, "hyphen vs en-dash formatting must still dedupe to one lens"
    lens = merged_lenses[0]
    assert lens.weight_g == 695, "manufacturer weight must win over Wikidata's conflicting value"
    assert lens.release_year == 2022, "release_year must be backfilled from Wikidata"
    assert lens.source == "manufacturer:sony+wikidata", "merged source must list both contributors"
    print("OK  lens merge assertions passed")

    print("\nAll merge scenarios validated successfully.")


if __name__ == "__main__":
    main()
