# Scraper pipeline

This folder holds a Python pipeline. The pipeline fetches camera and lens
data from Wikidata and from manufacturer websites. It merges the records,
then stores the result in a Postgres database. This pipeline builds the
real data source that the CamSpecs app will use, in place of the static
catalog in `lib/mock-data.ts`.

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

- `models/` — Pydantic schemas for `CameraSpecs` and `LensSpecs`, with
  validators that correct raw scraped values.
- `extractors/` — one module per data source: `wikidata.py` (SPARQL) and
  `nikon.py` (Playwright).
- `transformers/` — `merger.py`, which combines records from multiple
  sources into one clean record per item.
- `db/` — the Postgres connection, the ORM models, and the upsert logic.
- `tests/` — runnable scripts that check each layer, with mock data or a
  live connection.
- `main.py` — the pipeline orchestrator.

## Usage

Run each command from this folder, with the virtual environment active.

Fetch camera and lens data from Wikidata:

```bash
python -m extractors.wikidata --type both --limit 25
```

Scrape a Nikon product page:

```bash
python -m extractors.nikon --url "https://www.nikonusa.com/p/z6iii/1890/overview"
```

Run the test scripts:

```bash
python -m tests.test_schemas
python -m tests.test_merger
python -m tests.test_upsert
```

`test_upsert` needs a real Postgres connection, through `DATABASE_URL`. The
other two tests use only mock data.

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

1. **Fetch.** The pipeline calls each extractor. It fetches Wikidata
   cameras and lenses at the same time, then fetches each configured Nikon
   page.
2. **Merge.** `merger.py` combines records for the same item, from each
   source, into one record. A manufacturer record wins a conflict over a
   Wikidata record. An empty field on the winning record fills in from the
   other source.
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

- **Wikidata** gives broad coverage, through one SPARQL query per entity
  type. Wikidata items rarely have a value for sensor format or
  megapixels, for interchangeable-lens cameras. The pipeline stores
  `"other"` for a missing sensor format, and leaves megapixels empty.
- **Nikon's product pages** give detailed, accurate specifications, but
  only for the pages listed in `DEFAULT_NIKON_URLS`, inside `main.py`.
  Sony, Canon, and Panasonic block automated browsers with a WAF, from
  common environments like this one.

## Current status

The pipeline writes to its own Postgres database. The Next.js app still
reads from `lib/mock-data.ts`. The app's data layer must still switch from
`lib/mock-data.ts` to Postgres. This remains open, and appears again in
`ARCHITECTURE.md`, under Known limitations.

## GitHub Actions

`.github/workflows/scraper.yml` runs this pipeline on a schedule, and on a
manual trigger. The schedule runs on the first day of every odd month. Set
`DATABASE_URL` and `REVALIDATION_SECRET` as repository secrets, and
`SITE_URL` as a repository variable, before the schedule does useful
work.
