"""Test pipeline for the standard-format sensor dimension fallback.

Run with `python -m tests.test_sensor_fallback` from `scripts/scraper/`
(venv active). Feeds merged-shape records (as `backfill_sensor_dimensions`
would see them post-merge) through the fallback and asserts: known formats
get filled in, Canon's smaller APS-C sensor is distinguished from every
other brand's APS-C sensor, a record that already has exact dimensions is
left untouched, and unstandardized formats (1-inch, other) are skipped.
"""

from __future__ import annotations

from pprint import pprint

from models import CameraSpecs
from transformers.sensor_fallback import backfill_sensor_dimensions

CAMERA_FULL_FRAME_NO_SENSOR = {
    "brand": "Panasonic",
    "model": "Lumix S5 II",
    "mount": "L-Mount",
    "sensor_format": "full-frame",
    "source": "wikidata+versus",
}

CAMERA_APS_C_SONY_NO_SENSOR = {
    "brand": "Sony",
    "model": "Alpha 6700",
    "mount": "Sony E-mount",
    "sensor_format": "aps-c",
    "source": "versus",
}

CAMERA_APS_C_CANON_NO_SENSOR = {
    "brand": "Canon",
    "model": "EOS R50",
    "mount": "Canon RF",
    "sensor_format": "aps-c",
    "source": "wikidata",
}

CAMERA_MFT_NO_SENSOR = {
    "brand": "OM System",
    "model": "OM-1 Mark II",
    "mount": "Micro Four Thirds",
    "sensor_format": "micro-four-thirds",
    "source": "wikidata",
}

CAMERA_ALREADY_HAS_SENSOR = {
    "brand": "Nikon",
    "model": "Z6III",
    "mount": "Nikon Z-mount",
    "sensor_format": "full-frame",
    "sensor": {"width_mm": 35.9, "height_mm": 23.9},
    "source": "manufacturer:nikon",
}

CAMERA_UNSTANDARDIZED_FORMAT = {
    "brand": "Sony",
    "model": "RX100 VII",
    "mount": "Sony E-mount",
    "sensor_format": "other",
    "source": "wikidata",
}


def main() -> None:
    print("=== Backfilling sensor dimensions ===")
    cameras = [
        CameraSpecs.model_validate(CAMERA_FULL_FRAME_NO_SENSOR),
        CameraSpecs.model_validate(CAMERA_APS_C_SONY_NO_SENSOR),
        CameraSpecs.model_validate(CAMERA_APS_C_CANON_NO_SENSOR),
        CameraSpecs.model_validate(CAMERA_MFT_NO_SENSOR),
        CameraSpecs.model_validate(CAMERA_ALREADY_HAS_SENSOR),
        CameraSpecs.model_validate(CAMERA_UNSTANDARDIZED_FORMAT),
    ]
    result = backfill_sensor_dimensions(cameras)
    for camera in result:
        pprint(camera.model_dump())
        print()

    by_slug = {camera.slug: camera for camera in result}

    full_frame = by_slug["panasonic-lumix-s5-ii"]
    assert full_frame.sensor is not None
    assert (full_frame.sensor.width_mm, full_frame.sensor.height_mm) == (36.0, 24.0), (
        "full-frame must backfill to the standard 36x24mm"
    )

    sony_aps_c = by_slug["sony-alpha-6700"]
    assert sony_aps_c.sensor is not None
    assert (sony_aps_c.sensor.width_mm, sony_aps_c.sensor.height_mm) == (23.5, 15.6), (
        "non-Canon APS-C must backfill to 23.5x15.6mm"
    )

    canon_aps_c = by_slug["canon-eos-r50"]
    assert canon_aps_c.sensor is not None
    assert (canon_aps_c.sensor.width_mm, canon_aps_c.sensor.height_mm) == (22.3, 14.9), (
        "Canon APS-C must backfill to its smaller 22.3x14.9mm size, not the generic APS-C size"
    )

    mft = by_slug["om-system-om-1-mark-ii"]
    assert mft.sensor is not None
    assert (mft.sensor.width_mm, mft.sensor.height_mm) == (17.3, 13.0), (
        "micro-four-thirds must backfill to the standard 17.3x13mm"
    )

    z6iii = by_slug["nikon-z6iii"]
    assert z6iii.sensor is not None
    assert (z6iii.sensor.width_mm, z6iii.sensor.height_mm) == (35.9, 23.9), (
        "a record with exact dimensions from a source must not be overwritten by the fallback"
    )

    rx100 = by_slug["sony-rx100-vii"]
    assert rx100.sensor is None, (
        "unstandardized formats (other/1-inch) must be left null, not guessed at"
    )

    print("OK  sensor fallback assertions passed")
    print("\nAll sensor fallback scenarios validated successfully.")


if __name__ == "__main__":
    main()
