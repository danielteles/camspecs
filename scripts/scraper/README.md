# Scraper pipeline

This folder holds a Python pipeline. The pipeline fetches camera and lens
data from a few different external sources. It merges the records, then
stores the result in a Postgres database. The CamSpecs app reads its full
camera and lens catalog from this database, through
`lib/services/equipment.ts`.

## Requirements

- Python 3.11 or later
- A Postgres database
- Chromium, and its system dependencies, for Playwright (a setup command
  below installs both)

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

3. Install the Python dependencies.

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

- `models/` — `camera.py` and `lens.py` hold the `CameraSpecs` and
  `LensSpecs` Pydantic schemas, with validators that correct raw scraped
  values. `enums.py` holds `SensorFormat` and its free-text normalizer.
  `parsers.py` holds shared raw-value parsing helpers.
- `extractors/` — one module per data source. `curated_fallbacks.py`
  holds hand-sourced lookup tables for confirmed gaps in the other
  sources, each entry commented with its origin.
- `transformers/` — `merger.py` combines records from multiple sources
  into one clean record per item, by a fixed source-priority order.
  `sensor_fallback.py` fills in sensor dimensions for a record that
  resolved a standard sensor format but got no exact millimeter values
  from any source.
- `db/` — `connection.py` (the async engine and session factory),
  `schema.py` (the SQLAlchemy ORM models), and `upsert.py` (the upsert
  logic).
- `tests/` — runnable scripts that check each layer, with mock data or a
  live connection.
- `main.py` — the pipeline orchestrator.

## Usage

Run each command from this folder, with the virtual environment active.

Run a single extractor module on its own, for testing:

```bash
python -m extractors.<module_name> --help
```

Each module lists its own flags this way. This is useful when you want to
check one source's output without running the full pipeline.

Run the test scripts:

```bash
python -m tests.<test_module_name>
```

`tests/` holds one runnable script per layer: schemas, merging, curated
fallbacks, sensor backfill, per-source name normalization, and the
database upsert. Only the upsert test needs a real Postgres connection,
through `DATABASE_URL`. Every other test uses only mock data.

Run the full pipeline:

```bash
python main.py
```

Use `--dry-run` to fetch, merge, and validate records, without a write to
the database or a call to the revalidation endpoint.

```bash
python main.py --dry-run
```

## Pipeline stages

`main.py` runs five stages, in order, and logs the duration of each one.

1. **Fetch.** The pipeline calls each extractor. It fetches the
   structured-data source's cameras and lenses at the same time, then
   fetches each configured page from the other two sources. One source
   failing on one page logs a warning and skips that page, rather than
   stopping the whole run.
2. **Merge.** `merger.py` combines records for the same item, from each
   source, into one record. A manufacturer record wins a conflict over
   the third-party site's record, which wins over the structured-data
   source's record. An empty field on the winning record fills in from
   the next source in that order. Four more steps then run: two fill in
   known physical facts that no source supplies directly, one removes a
   record whose sensor format can never resolve because only the
   lowest-priority source ever contributed it, and one fills in a small,
   named list of confirmed release-date gaps.
3. **Validate.** Every record is already a Pydantic instance at this
   point, since each fetch and merge step validates its own output. This
   stage checks the final counts.
4. **Upsert.** The pipeline writes each record to Postgres. A new item
   inserts as a new row. An existing item updates only its empty columns.
   A later scrape never overwrites a value that a person, or an earlier
   scrape, already validated. Fields that describe the source of the
   data, for example `source` and `scraped_at`, always update to the
   latest run.
5. **Revalidate.** The pipeline calls `POST /api/revalidate` on the
   Next.js site, with the slugs of every camera and lens it upserted.
   This clears the cache for those pages before the 1-hour ISR window
   expires.

A revalidation failure does not fail the pipeline. By the time this stage
runs, Postgres already has the data.

## Data sources, and their limits

- A **structured public data source** gives broad coverage, through one
  query per entity type, run separately per mount so a low-release-cadence
  mount is not crowded out of its share of the result limit by a
  high-cadence one. This source rarely has a value for sensor format,
  sensor dimensions, or megapixels, for interchangeable-lens cameras. The
  pipeline stores `"other"` for a missing sensor format, and leaves
  megapixels and sensor dimensions empty, unless a fallback (below)
  resolves them.
- **Manufacturer product pages** give detailed, accurate specifications,
  but only for the pages listed in `main.py`. Some manufacturer sites
  block automated browsers outright, from common environments like this
  one, so this source only covers the manufacturers whose pages allow it.
- A **third-party specifications site** covers the same mounts the
  manufacturer source only partly reaches. L-Mount and Micro Four Thirds
  have no manufacturer or third-party source today, and rely on the
  structured public data source alone. The specifications site has no
  standalone lens pages for most mounts. A combined "camera + lens"
  listing is scraped for its lens half instead, except for one lens
  family, which does have its own standalone pages. This source needs a
  real browser to fetch, not a lighter HTTP client, for reasons specific
  to that site.
- **Curated fallbacks** (`extractors/curated_fallbacks.py`) cover two
  confirmed gaps no automated source can fill: the sensor format for
  three single-format mounts, and the release year for a small list of
  lens-kit slugs with no release-date value from any source. Each entry
  names its reasoning in a comment.

## Current status

The pipeline writes to the same Postgres database the Next.js app reads
from, through `lib/services/equipment.ts`. `ARCHITECTURE.md`'s Known
limitations section lists what is still open, for example
`getNativeCameraForLens`'s one-camera-per-mount simplification now that
several real camera bodies share a mount.

## GitHub Actions

`.github/workflows/scraper.yml` runs this pipeline on a schedule, and on a
manual trigger. The schedule runs on the first day of every odd month. Set
`DATABASE_URL` and `REVALIDATION_SECRET` as repository secrets, and
`SITE_URL` as a repository variable, before the schedule does useful
work.
