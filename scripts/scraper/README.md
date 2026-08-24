# Scraper pipeline

This folder holds a Python pipeline. The pipeline gets camera and lens
data from three sources: a third-party specifications site, a
structured public data source, and a list of manufacturer pages. It
merges the records into one clean catalog, and writes the result to a
Postgres database. The CamSpecs app reads its full camera and lens
catalog from this database, through `lib/services/equipment.ts`.

## Requirements

- Python 3.11 or later
- A Postgres database
- Chromium, and its system files, for Playwright (a setup command below
  installs both)

## Setup

Run these commands once, from this folder (`scripts/scraper/`).

1. Create a virtual environment.

   ```bash
   python3 -m venv .venv
   ```

2. Activate the virtual environment.

   ```bash
   source .venv/bin/activate
   ```

3. Install the Python packages.

   ```bash
   pip install -r requirements.txt
   ```

4. Install the Chromium browser for Playwright.

   ```bash
   playwright install chromium --with-deps
   ```

5. Copy the example environment file to `.env`.

   ```bash
   cp .env.example .env
   ```

6. Set a real value for each variable in `.env`.

## Environment variables

| Variable              | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`        | Connection string for the Postgres database.                                  |
| `SITE_URL`            | Base URL of the Next.js site, for cache revalidation.                         |
| `REVALIDATION_SECRET` | Shared secret for `POST /api/revalidate`. It must match the site's own value. |

## Project structure

- `models/` — the data rules. `camera.py` and `lens.py` hold the
  `CameraSpecs` and `LensSpecs` schemas. Each schema checks and cleans a
  raw scraped value. `enums.py` holds `SensorFormat` and its text
  cleaner. `parsers.py` holds shared helpers, for example
  `normalize_brand` and `normalize_mount`.
- `extractors/` — one module per data source, for example `versus.py`
  and `wikidata.py`. `curated_fallbacks.py` holds hand-checked facts for
  gaps that no source fills. Each entry names its source in a comment.
- `transformers/` — `merger.py` combines the records for one item, from
  every source, into one clean record. `sensor_fallback.py` fills in
  sensor size for a camera with a known sensor format but no exact
  measurement from any source.
- `db/` — `connection.py` (the database connection), `schema.py` (the
  table definitions), and `upsert.py` (the save logic).
- `tests/` — checks for each layer. Most tests use mock data. One test
  needs a real Postgres connection. One test needs a real connection to
  the specifications site.
- `main.py` — runs the full pipeline, start to finish.

## Usage

Run each command from this folder, with the virtual environment active.

Run one extractor on its own, to test it:

```bash
python -m extractors.<module_name> --help
```

Each module lists its own flags this way. Use this command to check one
source's output, without a full pipeline run.

Run a mock-data test script:

```bash
python -m tests.<test_module_name>
```

Run the pytest suite:

```bash
pytest
```

By default, `pytest` skips the live test against the specifications
site. That test needs network access, and takes about one minute. Run
it on its own with this command:

```bash
pytest -m integration
```

Run the full pipeline, with the fixed slug list already in `main.py`:

```bash
python main.py
```

Add `--dry-run` to fetch, merge, and check records, with no database
write and no call to the revalidation endpoint.

```bash
python main.py --dry-run
```

Add `--discover-versus-slugs` to find every camera and lens on the
specifications site first, not only the fixed list. See "How the
scraper finds every camera and lens" below.

```bash
python main.py --discover-versus-slugs
```

## Pipeline stages

`main.py` runs five stages, in order, and logs the time each stage
takes.

1. **Fetch.** The pipeline calls each extractor. It gets the structured
   source's cameras and lenses at the same time. Then it fetches each
   configured page from the other two sources. A failure on one page
   logs a warning and skips that page. It does not stop the run.
2. **Merge.** `merger.py` combines the records for one item, from every
   source, into one clean record. See "How the scraper keeps good data"
   below for the full set of rules.
3. **Validate.** Every record is already checked at this point, since
   the fetch and merge stages each check their own output. This stage
   checks the final counts.
4. **Upsert.** The pipeline writes each record to Postgres. A new item
   becomes a new row. An existing item gets a new value only in an empty
   column. A later scrape never replaces a value that a person, or an
   earlier scrape, already checked. Fields that describe the source of
   the data, for example `source` and `scraped_at`, always update to the
   latest run.
5. **Revalidate.** The pipeline calls `POST /api/revalidate` on the
   Next.js site, with the slugs of every camera and lens it wrote. This
   clears the cache for those pages, before the one-hour window ends on
   its own. A failed call at this stage does not fail the pipeline.
   Postgres already has the data by this point.

## How the scraper finds every camera and lens

The specifications site groups its cameras and lenses under two pages:
one for cameras, one for lenses. Each page lists products by brand, but
it does not show every product at first load. Each brand section starts
with a short list, and a "Show more" button.

`extractors/versus.py`'s discovery functions open these two pages, and
click every "Show more" button, until no button is left. Only then do
they read the full product list. This step matters. A page load with no
clicks shows about 130 products. The full site lists more than 1,800
products, across every brand.

Pass `--discover-versus-slugs` to `main.py` to run this discovery step.
The pipeline adds every product it finds to the fixed slug list already
in `main.py`. It logs a count for each brand, for example "Canon: 160
discovered, 160 kept". This log line makes a drop in one brand's count
easy to see in a future run.

Discovery finds every product for a brand, not only mirrorless cameras.
A brand's product list includes DSLR cameras and fixed-lens cameras
too. The pipeline still fetches each of these pages. It drops the ones
with an unsupported mount later, in the merge stage. See the project's
root `README.md`, in its "Architecture: supported mounts" section, for
the list of supported mounts. The structured source needs no such step.
Each of its queries already asks for one supported mount at a time.

## How the scraper keeps good data

A real camera or lens page is sometimes missing one fact, for example
its release year or its lens mount. Earlier code in this pipeline
treated a missing mount as an error, and dropped the whole record. This
pipeline instead treats a missing fact as normal, and keeps the record.

Three parts of the pipeline work together on this rule:

- **The schema allows a gap.** `mount` on a `CameraSpecs` or `LensSpecs`
  record can be empty. `main.py`'s `_drop_unsupported_mounts` step
  removes a record only after a check finds its mount falls outside the
  eight supported mounts.
- **Curated fallbacks fill in a checked gap.** `extractors/
curated_fallbacks.py` holds small, named lists of facts that no
  automated source gives, for example the release year of one specific
  camera. Each entry names its source in a comment. `merger.py`'s
  `apply_curated_mount_overrides`, `apply_curated_camera_release_years`,
  and `apply_curated_lens_release_years` read from these lists.
- **Brand and model text gets cleaned up.** `models/parsers.py`'s
  `normalize_brand` fixes a known brand-name difference between
  sources, for example a legal company name against a plain brand name.
  `strip_redundant_brand_prefix` removes a brand name that a source
  repeats inside the model text. One example is a model field that
  starts with its own brand name. Both checks run inside the schema
  itself, so every source gets the same treatment.

The upsert stage adds one more layer of protection. It never replaces a
value already saved from an earlier run. A gap that a later run fills
in updates the row. A value that is already correct stays as it is.

The Next.js app applies one more rule of its own, in `lib/services/
equipment.ts`. A camera or lens with a missing display fact, for
example its release year, still shows in the catalog. Only a missing
sensor size hides a camera, since the site's equivalence calculator
needs a real sensor size to run.

## Tests

Run these tests from `scripts/scraper/`, with the virtual environment
active.

Most tests use fixed mock data, and run fast, with a command like
`python -m tests.test_merger`. Each one checks one layer: schemas,
merging, curated fallbacks, sensor backfill, and per-source brand and
name cleanup.

`tests/test_upsert.py` needs a real Postgres connection, through
`DATABASE_URL`. It writes one test row, checks the save rules, then
removes the row.

`tests/test_versus_discovery_integration.py` is a real pytest test, not
a script, and it needs network access to the specifications site. It
calls the real discovery functions, then checks that each major brand
returns at least a fixed minimum count of cameras and lenses. If the
"Show more" click step breaks again, this test fails. Each brand's
count drops back toward its old, low value in that case. Run this test
on its own with `pytest -m integration`. It is not part of
the default `pytest` run, since it takes about one minute and needs
network access.

## Data sources, and their limits

- The **structured public data source** gives broad coverage, through
  one query per entity type, run once per mount. This keeps a
  low-release mount from losing its share of the result limit to a
  high-release mount. This source rarely has a value for sensor format,
  sensor dimensions, or megapixels. The pipeline stores `"other"` for a
  missing sensor format, and leaves megapixels and sensor dimensions
  empty, unless a fallback resolves them.
- **Manufacturer product pages** give detailed, accurate specifications,
  but only for the pages listed in `main.py`. Some manufacturer sites
  block automated browsers, from common setups like this one. This
  source covers only the manufacturers whose pages allow this.
- The **third-party specifications site** covers the mounts the
  manufacturer source only partly reaches. L-Mount and Micro Four
  Thirds have no manufacturer source today, and rely on the structured
  source alone. This site has no standalone lens pages for most mounts.
  A combined "camera + lens" listing gets scraped for its lens half
  instead, except for one lens family, which has its own standalone
  pages. This source needs a real browser to fetch, not a lighter HTTP
  client.

**Curated fallbacks** (`extractors/curated_fallbacks.py`) cover gaps
that no automated source fills. Three gap types exist today:

- A sensor format for three single-format mounts.
- A mount value for one checked scraping gap.
- A release year for a small, named list of cameras and lens kits with
  no release-date value from any source.

## Current status

The pipeline writes to the same Postgres database the Next.js app reads
from, through `lib/services/equipment.ts`. `ARCHITECTURE.md`'s Known
limitations section lists what remains open, for example
`getNativeCameraForLens`'s one-camera-per-mount simplification, now
that several real camera bodies share one mount.

## GitHub Actions

`.github/workflows/scraper.yml` runs this pipeline on a schedule, and
on a manual trigger. The schedule runs on the first day of every odd
month. Set `DATABASE_URL` and `REVALIDATION_SECRET` as repository
secrets, and `SITE_URL` as a repository variable, before the schedule
runs.
