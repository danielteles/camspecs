"""Curated static overrides for confirmed upstream data gaps.

Every entry here exists because the normal pipeline (source scrape/SPARQL
crawl + cross-source merge, see `transformers/merger.py`) has been checked
live and found structurally unable to resolve the field on its own — not
because adding a static value is the default move. Design principle: prefer
an explicit, sourced override over silently dropping valid physical gear
(see `transformers/merger.py`'s `drop_unmergeable_wikidata_cameras`).
"""

from __future__ import annotations

from models.enums import SensorFormat

# Mount slug -> the one physical sensor format every camera on that mount has
# ever shipped with. Wikidata has no populated sensor-format property for
# camera items at all (see `extractors/wikidata.py`'s `_map_camera_binding`
# — every Wikidata camera record is created with sensor_format="other"), so
# a Wikidata-only camera on one of these mounts is otherwise permanently
# stuck at "other" and dropped by `drop_unmergeable_wikidata_cameras`, even
# though its real sensor format is a settled fact of the mount itself, not
# something that needs discovering per model:
#   - Micro Four Thirds is a joint Olympus/Panasonic spec built around one
#     sensor size; no MFT-mount body has ever shipped with anything else.
#   - Fujifilm X-mount is Fujifilm's APS-C-only mirrorless system — their
#     larger-format bodies use the separate G-mount instead.
#   - Fujifilm G-mount is exclusively the GFX medium-format line.
# canon-rf, nikon-z, sony-e, and l-mount are deliberately absent — each spans
# more than one real sensor format across shipped bodies (e.g. Canon RF: R5
# is full-frame, R10 is APS-C), so mount alone can't determine the format
# there and guessing would risk mislabeling a real camera.
MOUNT_SENSOR_FORMATS: dict[str, SensorFormat] = {
    "micro-four-thirds": SensorFormat.MICRO_FOUR_THIRDS,
    "fujifilm-x": SensorFormat.APS_C,
    "fujifilm-g": SensorFormat.MEDIUM_FORMAT,
}

# Versus.com "camera + lens" kit slug (see `main.py`'s DEFAULT_VERSUS_LENS_
# SLUGS) -> the lens half's real release year. These 5 are exactly the
# lens-kit items `main.py`'s VERSUS_LENS_WIKIDATA_QIDS comment already
# documents as checked live, one QID at a time, and confirmed to carry no
# P577 (publication date) or P6949 (announcement date) statement on Wikidata
# at all — a genuine upstream gap, not a query-limit issue a bigger
# --wikidata-lens-limit would fix. (The 6th lens-kit item, sony-fe-50mm-f1-8,
# isn't here because its Wikidata record *does* have a date and is already
# backfilled dynamically by that QID lookup.)
#
# Each year is the lens's own manufacturer-announced release year (the same
# P6949-as-stand-in-for-P577 convention `extractors/wikidata.py`'s
# `_parse_release_year` already uses), sourced independently of Wikidata:
# Versus.com camera product slug -> its real interchangeable-lens mount,
# for the confirmed case where Versus's own spec table omits the
# `lens-mount` row despite the camera genuinely having one. Discovered by
# probing every Versus page reachable from `extractors/versus.py`'s
# discover_camera_slugs() and diffing which real interchangeable-lens
# bodies came back with `mount: null` (see models/camera.py's `mount` field
# for why that no longer crashes the pipeline outright). Deliberately does
# NOT include fixed-lens cameras that also have no `lens-mount` row (e.g.
# the Fujifilm X100 series, XQ2, XF1, X20, GFX100RF) — those genuinely have
# no mount, and `main.py`'s `_drop_unsupported_mounts` correctly excludes
# them from the mirrorless-interchangeable-lens catalog on that basis.
#   - sony-alpha-nex-c3: Sony NEX-C3 (2011) — every NEX-series body is
#     Sony E-mount by definition (E-mount was introduced with the NEX
#     line); confirmed live the page's spec table has no lens-mount row at
#     all despite every other NEX model's page (nex-3, nex-5, nex-5n, ...)
#     having one, so this is a per-page scraping gap, not an ambiguous fact.
VERSUS_SLUG_MOUNT_OVERRIDES: dict[str, str] = {
    "sony-alpha-nex-c3": "sony-e",
}

LENS_KIT_RELEASE_YEARS: dict[str, int] = {
    # Sony E 18-135mm F3.5-5.6 OSS (SEL18135) — announced 2018-01-04.
    # https://www.dpreview.com/news/7071041993/
    "sony-alpha-6700-sony-e-18-135mm-f3-5-5-6-oss": 2018,
    # Canon RF 24-105mm F4L IS USM — announced 2018-09-05 alongside the
    # original EOS R. https://www.usa.canon.com/newsroom/2018/20180905-rf
    "canon-eos-r6-mark-ii-canon-rf-24-105mm-f-4l-is-usm": 2018,
    "canon-eos-r5-canon-rf-24-105mm-f-4l-is-usm": 2018,  # same lens, different kit page
    # Canon RF 24-50mm F4.5-6.3 IS STM — announced 2023-02-08 alongside the
    # EOS R8/R50. https://www.dpreview.com/news/7666346476/
    "canon-eos-r8-canon-rf-24-50mm-f-4-5-6-3-is-stm": 2023,
    # NIKKOR Z 24-120mm f/4 S — announced 2021-10-28.
    # https://www.dpreview.com/news/6063825367/
    "nikon-z6-iii-nikon-nikkor-z-24-120mm-f-4-s": 2021,
    # NIKKOR Z 40mm f/2 (SE) — announced 2022-11-08 alongside the special-
    # edition Z fc. https://www.imaging-resource.com/news/2022/11/08/
    "nikon-zf-nikon-nikkor-z-40mm-f-2-se": 2022,
}
