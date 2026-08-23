"""Test pipeline for Wikidata manufacturer-label normalization.

Run with `python -m tests.test_wikidata_brand_normalization` from
`scripts/scraper/` (venv active). Feeds synthetic SPARQL binding dicts,
shaped exactly like the live endpoint's JSON results, through
`_map_camera_binding`/`_map_lens_binding` and asserts the resulting brand
and model are clean and non-duplicated — the double-branding bug this
fixes (e.g. brand="Sony Group", model="Sony E 11mm F1.8", displayed as
"Sony Group Sony E 11mm F1.8") never reaches the merge/validation step.

The four corporate labels below (Sony Group, Canon Inc., Fujifilm
Corporation, Panasonic Holdings Corporation) are verified real values from
a live pipeline run, not guesses. "Nikon Corporation" and the aperture
brand exercise the regex fallback for a manufacturer not in the verified
alias map.
"""

from __future__ import annotations

from pprint import pprint

from extractors.wikidata import MOUNT_QIDS, _map_camera_binding, _map_lens_binding


def _camera_binding(
    qid: str, item_label: str, manufacturer_label: str, mount_key: str = "sony-e"
) -> dict:
    return {
        "item": {"type": "uri", "value": f"http://www.wikidata.org/entity/{qid}"},
        "itemLabel": {"type": "literal", "value": item_label},
        "manufacturerLabel": {"type": "literal", "value": manufacturer_label},
        "mount": {
            "type": "uri",
            "value": f"http://www.wikidata.org/entity/{MOUNT_QIDS[mount_key]}",
        },
    }


def _lens_binding(
    qid: str, item_label: str, manufacturer_label: str, mount_key: str = "sony-e"
) -> dict:
    binding = _camera_binding(qid, item_label, manufacturer_label, mount_key)
    binding["minFocalLength"] = {"type": "literal", "value": "50"}
    binding["maxFocalLength"] = {"type": "literal", "value": "50"}
    binding["minAperture"] = {"type": "literal", "value": "1.8"}
    binding["maxAperture"] = {"type": "literal", "value": "22"}
    return binding


CAMERA_CASES = [
    # (binding, expected_brand, expected_model)
    (
        _camera_binding("Q1", "Sony Alpha 7 IV", "Sony Group"),
        "Sony",
        "Alpha 7 IV",
    ),
    (
        _camera_binding("Q2", "Canon EOS R10", "Canon Inc.", mount_key="canon-rf"),
        "Canon",
        "EOS R10",
    ),
    (
        _camera_binding(
            "Q3", "Fujifilm X-T30 II", "Fujifilm Corporation", mount_key="fujifilm-x"
        ),
        "Fujifilm",
        "X-T30 II",
    ),
    (
        _camera_binding(
            "Q4", "Nikon Z50 II", "Nikon", mount_key="nikon-z"
        ),  # no-op control: already correct, must not regress
        "Nikon",
        "Z50 II",
    ),
    (
        _camera_binding(
            "Q5", "Panasonic Lumix S5 II", "Panasonic Holdings Corporation", mount_key="l-mount"
        ),
        "Panasonic",
        "Lumix S5 II",
    ),
    (
        # Not a value ever observed live — a hypothetical manufacturer to
        # prove the generic corporate-suffix regex fallback works for a
        # label outside the verified alias map, not just the four known
        # cases above.
        _camera_binding("Q6", "Pentax K-3 III", "Pentax Corporation", mount_key="l-mount"),
        "Pentax",
        "K-3 III",
    ),
]

LENS_CASES = [
    (
        _lens_binding("Q10", "Sony E 11mm F1.8", "Sony Group"),
        "Sony",
        "E 11mm F1.8",
    ),
]


def main() -> None:
    print("=== Normalizing camera manufacturer labels ===")
    for binding, expected_brand, expected_model in CAMERA_CASES:
        result = _map_camera_binding(binding)
        assert result is not None, f"binding for {binding['itemLabel']['value']} was dropped"
        pprint(result)
        print()
        assert result["brand"] == expected_brand, (
            f"expected brand {expected_brand!r}, got {result['brand']!r}"
        )
        assert result["model"] == expected_model, (
            f"expected model {expected_model!r}, got {result['model']!r}"
        )
        title = f"{result['brand']} {result['model']}"
        assert title.count(expected_brand) == 1, (
            f"brand must appear exactly once in the final title, got {title!r}"
        )
    print("OK  camera brand normalization assertions passed\n")

    print("=== Normalizing lens manufacturer labels ===")
    for binding, expected_brand, expected_model in LENS_CASES:
        result = _map_lens_binding(binding)
        assert result is not None, f"binding for {binding['itemLabel']['value']} was dropped"
        pprint(result)
        print()
        assert result["brand"] == expected_brand
        assert result["model"] == expected_model
        title = f"{result['brand']} {result['model']}"
        assert title.count(expected_brand) == 1, (
            f"brand must appear exactly once in the final title, got {title!r}"
        )
    print("OK  lens brand normalization assertions passed")

    print("\nAll Wikidata brand normalization scenarios validated successfully.")


if __name__ == "__main__":
    main()
