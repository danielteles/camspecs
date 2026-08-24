# Architecture

CamSpecs is a proof-of-concept (PoC) platform for camera and lens
comparison, with a dynamic equivalence calculator. The project is a
technical portfolio piece. This document explains the technical decisions
behind the code, and the reasons for them.

## Stack

| Concern              | Choice                                                                        |
| -------------------- | ----------------------------------------------------------------------------- |
| Framework            | Next.js 16 (App Router, Turbopack)                                            |
| Language             | TypeScript, `strict: true`                                                    |
| UI runtime           | React 19                                                                      |
| Styling              | Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)                   |
| Component primitives | shadcn/ui on **Radix UI** + `cmdk`                                            |
| i18n                 | next-intl (`en`, `pt-BR`, `es`)                                               |
| Testing              | Vitest, React Testing Library                                                 |
| Git hooks            | Husky                                                                         |
| CI                   | GitHub Actions                                                                |
| Database             | Postgres (Neon in production), through Kysely and `pg`                        |
| Data pipeline        | Python (`scripts/scraper/`) — Pydantic, SQLAlchemy, Playwright, BeautifulSoup |

### A note on Next.js 16

This project uses Next.js 16. Next.js 16 has breaking changes. Most public
docs and AI training data came from before these changes. The changes
include:

- Next.js renamed `middleware.ts` to `proxy.ts`.
- `params` and `searchParams` are now promises everywhere, for example in
  `opengraph-image` files.
- Next.js added global type helpers: `PageProps<Route>` and
  `LayoutProps<Route>`.
- Next.js added `next/root-params`, a way to read a root dynamic segment
  (for example `[locale]`) from any part of the server tree, without
  passing it through each component.

This document checked each behavior against the framework's own docs, in
`node_modules/next/dist/docs`, instead of prior knowledge. This version gap
is the reason. Each later section names the place where this gap changed
a decision.

## Rendering strategy

The main rule: use Server Components by default. Add `"use client"` only
at the smallest part of the tree that needs interactivity, state, or a
browser API.

- `app/[locale]/compare/page.tsx` is a Server Component. It reads
  `searchParams`, finds the full camera and lens records for each slug,
  and computes each spec on the server. This includes the equivalence
  math. The comparison table's content never ships as client JavaScript.

- `DiffToggle` (`components/diff-toggle.tsx`) is the only Client Component
  on this page. It does not know the table's structure. The page passes
  the server-rendered table to `DiffToggle` as `children`. This is a
  standard React and Next.js pattern. A Client Component can receive a
  Server Component through a prop. The Server Component still renders on
  the server.

  `DiffToggle` toggles a `data-diff` attribute on a wrapper `div`. A CSS
  rule in `app/globals.css` does the actual work:

  ```css
  [data-diff] [data-identical] {
    display: none;
  }
  ```

  Rows get a `data-identical` mark at render time. The server computes
  this mark by comparing values. As a result, "hide identical specs"
  needs no client-side data and no re-render of the table. It is only an
  attribute change.

- `CompareSelector` (`components/compare-selector.tsx`) is a Client
  Component. It needs client state for the text input, a debounced fetch
  to `/api/search`, and `useSearchParams` and `useRouter` to keep the URL
  in sync.

  The URL, for example `?items=slug1,slug2`, is the actual state. There
  is no separate client store. As a result, a user can share the
  comparison with a plain link. The Server Component page needs no
  client-side hydration to know what to render.

- Product pages, `/cameras/[slug]` and `/lenses/[slug]`, are static. They
  use `generateStaticParams` to list every camera and lens slug. Next.js
  combines this list with the locale list from the parent `[locale]`
  segment automatically.

  The pages also set `export const revalidate = 3600`, for ISR
  (Incremental Static Regeneration). This is a one-hour fallback: the
  scraper pipeline's own call to `POST /api/revalidate`, after an
  upsert, normally clears a changed page's cache well before this
  window would.

## Internationalization

next-intl handles routing, for example `/en/...`, `/pt-BR/...`, and
`/es/...`, through `proxy.ts`. It also handles message loading. `i18n/routing.ts`
lists the three supported locales.

`i18n/request.ts` resolves the locale with `next/root-params`. This is the
Next.js 16 replacement for the older `requestLocale` parameter, now
deprecated in the types of next-intl. This method avoids passing the
locale down from the root layout through each component.

Two decisions about i18n were not obvious until something broke. This
section names them.

1. **Query parameters must survive a locale switch.** At first,
   `LanguageSwitcher` read only `usePathname()`. A user selected items on
   `/compare?items=...`, then switched language, and lost the selection.
   The link that `LanguageSwitcher` built did not include the query
   string.

   The fix: read `useSearchParams()` too, and add its value to the locale
   link. This fix also needed a `Suspense` boundary around that part of
   the component. The reason: `useSearchParams` removes a Client
   Component from static rendering, unless a `Suspense` boundary wraps
   it.

2. **Locale-aware navigation turns every query value into a string,
   including `undefined`.** The navigation helpers of next-intl build the
   query string with `String(value)`, for each key in the object you
   pass. As a result, `{ items: undefined }` gives a literal
   `?items=undefined` in the URL, not an omitted parameter.

   `CompareSelector.updateSelection` avoids this fault. When there is
   nothing to show, it removes the `query` key. It does not set the key
   to `undefined`.

Technical notation, for example `ƒ/1.8`, `50mm`, `1.53×`, and `82.8°`,
uses plain string templates, not `Intl.NumberFormat`. Camera spec sheets
in English and Portuguese sources use this same notation, in both
languages. The app translates all other text, for example labels, sensor
format names, and item type words.

## Design system

shadcn/ui changed after most public guides about it were written. It now
builds components on one of three primitive libraries: Radix UI, the
newer Base UI, or React Aria. When you run `shadcn init`, you pick the
library.

This project uses **Radix UI**. The reasons: wide name recognition, and a
long history of use. Base UI is the newer default.

This choice had one real effect: the `Combobox` recipe of shadcn, in this
version, works only with Base UI. Radix Primitives never had a combobox
primitive.

Instead of adding a second headless UI library for one component,
`CompareSelector` combines the `Popover` of Radix with `cmdk`. `cmdk` is
the library behind the classic, pre-Base-UI combobox recipe of shadcn.
`cmdk` builds the WAI-ARIA combobox, listbox, and option pattern on its
own: `role="combobox"`, `aria-expanded`, `aria-activedescendant`,
`role="listbox"`, and `role="option"`. This document checked these roles
directly in the `cmdk` source code.

## Data layer

The catalog lives in Postgres (Neon in production), not in memory. This
PoC started with a hand-written catalog in `lib/mock-data.ts`. That file
is gone. The scraper pipeline (below) now populates the real database,
and the app reads it.

`lib/db/client.ts` opens a Kysely query builder on top of a `pg`
connection pool. `getDb()` caches this pool on `globalThis`, so a Next.js
dev-mode module reload does not open a new pool on every edit and exhaust
the database's connection limit. `lib/db/schema.ts` gives Kysely the
shape of the `cameras` and `lenses` tables. The Python pipeline owns the
actual migrations; this file only describes the result for the query
builder.

`isDatabaseConfigured()`, in `lib/db/client.ts`, reports whether
`DATABASE_URL` is set. Static generation for the catalog and product
pages runs at build time, before a CI secret is guaranteed to exist. Each
page checks this function first, and renders an empty catalog with a
logged warning instead of a hard build failure when the variable is
missing.

`lib/services/equipment.ts` reads the tables through Kysely, and exposes
`getAllCameras`, `getAllLenses`, `getCameraBySlug`, and `getLensBySlug`.
The Postgres `mount` and `sensor_format` columns are plain strings, with
no database-level enum constraint (see `scripts/scraper/db/schema.py`).
`toCamera` and `toLens`, inside this file, re-check each row against the
frontend's stricter `MountId` and `SensorFormat` unions at the read
boundary. A row with an unsupported mount, an unsupported sensor format,
or a missing required field is skipped, with a logged reason, instead of
reaching a page with a fake default value. This is the third enforcement
point in README.md's "Architecture: supported mounts" section.

A lens has no sensor of its own. `getNativeCameraForLens`, in
`lib/compare-data.ts`, finds a camera in the catalog with the same mount,
and uses that camera's crop factor for the lens's 35mm-equivalent specs.
This PoC simplification was originally hidden by a curated mock catalog
with exactly one camera per mount. The real catalog has no such
guarantee: `scripts/scraper/main.py` scrapes several camera bodies per
mount, from more than one source. As a result,
`getNativeCameraForLens` picks whichever matching camera Kysely's
`orderBy("brand").orderBy("model")` puts first, not a camera the user
picked. A real product needs the user to pick a body, instead of the app
inferring one.

Every part of the app that reads the catalog uses one of a small set of
pure functions. Each function has its own tests, and each takes
cameras and lenses as plain arguments rather than reading a data source
itself. As a result, the same functions run against live Postgres data in
pages and API routes, and against the fixed fixtures in
`test/mocks/equipment.ts` in tests. This avoids ad hoc lookups spread
across many pages.

`lib/search.ts` holds `buildCatalog`, `searchCatalog`, and
`resolveCatalogSlugs`. `buildCatalog` flattens the camera and lens arrays
into one small index of brand, model, and mount. `/api/search` and the
chips of the selector use `searchCatalog` and `resolveCatalogSlugs` on
this index.

`lib/compare-data.ts` holds two functions. `resolveComparisonItems` turns
slugs into full records. `buildComparisonRows` turns records into a row
model that does not depend on locale. If a value needs translation, it
has an `i18n:` prefix. Otherwise, the row value is `null`, for "not
applicable".

One function, `buildComparisonRows`, feeds five places in the app:

- The multi-item compare table.
- The identical-row check in diff mode.
- The single-item spec sheet on each product page (2 page types).
- Both OpenGraph images.

`formatRowValue` and `getFormattedRowValue` share the translation logic
across all five places.

Each `Camera` and `Lens` record carries an `updatedAt` field, set by the
scraper pipeline's last sync. `LastUpdatedBadge`
(`components/last-updated-badge.tsx`) renders this value on product
pages and the compare page, as a single date or an aggregate across
every compared item. This is the one piece of scraper provenance the UI
surfaces directly to a reader.

## Catalog browse pages

`/cameras` and `/lenses` (`app/[locale]/cameras/page.tsx` and
`app/[locale]/lenses/page.tsx`) list the full catalog. Each page is a
Server Component. It calls `getAllCameras` or `getAllLenses` once, then
passes the array to a Client Component, `CamerasCatalog` or
`LensesCatalog`.

The Client Component holds the search text and a facet filter (sensor
format for cameras, mount for lenses) in local state, and filters the
already-fetched array in memory with `useMemo`. There is no `/api/search`
round trip on this page. A user reaches a product page from a card built
by the shared `CatalogItemCard` component, or adds the item to a
comparison directly from the same card.

## Scraper pipeline

`scripts/scraper/` holds a separate Python system. It fetches camera and
lens data from external sources, merges and cleans the records, and
writes them to the Postgres database the app reads from. See
`scripts/scraper/README.md` for setup and usage.

The pipeline has five stages, in `main.py`: fetch, merge, validate,
upsert, and revalidate. Three extractors run in the fetch stage today,
each pulling from a different external source: a broad structured-data
query, a scrape of a manufacturer's own product pages, and a scrape of a
third-party specifications site. Each extractor is its own module in
`extractors/`.

`merger.py` combines records for the same item, from each source, into
one record. `merge_key` groups records by mount plus a normalized
brand-and-model string, so cosmetic differences between sources (for
example, one source's "Z6III" against another source's "Z6 III") still
match. Within a group, a fixed priority order decides each field: a
manufacturer record (`source` prefixed `manufacturer:`) wins over the
third-party site's record, which wins over the structured-data source's
record. An empty field on the winning source fills in from the next
source in that order.

The merge stage runs four more steps after this three-way merge, each in
`transformers/merger.py` or `transformers/sensor_fallback.py`:

- One step fills in `sensor_format` for the three mounts where it is a
  fixed physical fact (Micro Four Thirds, Fujifilm X, Fujifilm G), since
  the structured-data source has no populated sensor-format property for
  any camera and would otherwise leave these stuck at `"other"`.
- Another step removes a merged camera record that is still `"other"`
  and came only from that structured-data source. No later step or
  frontend rule can resolve this record to a real sensor format, so
  keeping it would only upsert a row nobody can ever see.
- `backfill_sensor_dimensions` fills in `sensor` width and height, in
  millimeters, from a fixed lookup table, for a record that resolved a
  standard sensor format but got no exact dimensions from any source.
  Canon's APS-C sensor gets its own entry in this table, since it is
  physically smaller than every other manufacturer's APS-C sensor, by
  close to 5%.
- A final step fills in `release_year` for a small, named list of
  lens-kit slugs, each checked against the structured-data source and
  confirmed to carry no release-date property at all.

`extractors/curated_fallbacks.py` holds the two lookup tables these last
two steps read from, each with a comment that names the reasoning and
date behind every entry. This keeps a hand-written fact traceable,
instead of mixing it silently into the scraped data.

The upsert stage writes each record to Postgres, through SQLAlchemy and
asyncpg. A new item inserts as a new row. An existing item updates only
its empty columns. A later scrape never overwrites a value that a
person, or an earlier scrape, already validated.

The final stage calls a new API route, `POST /api/revalidate`
(`app/api/revalidate/route.ts`). This route checks a shared secret, then
clears the ISR cache for each camera and lens page the pipeline touched.
Without this call, a change waits for the existing 1-hour `revalidate`
window to expire on its own. A failed revalidation call does not fail
the pipeline, since Postgres already holds the data by this stage.

`.github/workflows/scraper.yml` runs the pipeline on a schedule, and on a
manual trigger with a dry-run option.

## Math engine

`lib/equivalence.ts` computes crop factor, 35mm-equivalent focal length
and aperture, and field of view. `lib/fov-geometry.ts` computes the SVG
wedge geometry for the field-of-view tool. Both files hold pure
functions, with no dependency on the framework.

Each function checks its input, and throws a `RangeError` on an invalid
value. The tests use exact values that a reader can check by hand, where
possible. Examples:

- Pythagorean triples, for sensor diagonals.
- An 18mm and 36mm pair, which gives an exact 90° field of view.
- A 90° field of view, which gives a 45° half-angle where `sin` and
  `cos` are equal.

This method checks the math itself, not only the output of the code.

## Search and the compare selector

`GET /api/search` is a plain Route Handler, outside the `[locale]`
segment. API routes have no locale. The route supports two query
parameters: `?q=` for a substring search, and `?slugs=` for an exact
match on a list of slugs. A user can load a `/compare?items=...` URL
directly, instead of building it through the UI. When this happens, the
app uses `?slugs=` to fill in the comparison chips.

`CompareSelector` debounces the search query, and cancels stale requests
with `AbortController`. It also limits the selection to 4 items. Two
layers enforce this limit. In the UI, the search list shows a "maximum
reached" message once full. In `lib/compare-params.ts`, `parseCompareItems`
removes duplicates and caps the list at 4, no matter what a hand-edited
URL contains.

## Data visualization

The field-of-view tool, `components/field-of-view-visualizer.tsx`, sits
on each lens product page. It is a small Client Component. It wraps a
native `<input type="range">`, and calls the same
`getHorizontalFieldOfView` function from the math engine.

`computeFovWedge`, in `lib/fov-geometry.ts`, computes all the geometry:
the wedge shape and the angle-indicator arc. This is a pure, tested
function. `FieldOfViewDiagram` renders this geometry, and does no math of
its own.

The SVG has an `aria-hidden` mark. The app also renders the same computed
value as visible text, marked `aria-live="polite"`. As a result, the
diagram is a visual addition. It is not the only way a reader gets the
information.

## Accessibility

This project has a baseline of accessibility work:

- Semantic landmarks.
- `scope` on table headers.
- Labeled form controls.
- A skip link.
- The **strict** rule set of `eslint-plugin-jsx-a11y`, added on top of the
  rule set inside `eslint-config-next`.

Beyond this baseline, we found and fixed two defects, instead of shipping
them:

- The light-mode focus ring (`--ring`) of the shadcn Nova preset reached
  only about 2.6:1 contrast, against a white page background. This is
  under the 3:1 minimum of WCAG 2.1 SC 1.4.11, for non-text UI
  indicators. We computed the correct value directly, through an OKLCH to
  linear-sRGB to relative-luminance conversion, instead of a guess. The
  new value reaches about 4.7:1 contrast, which matches the value that
  the preset's own dark mode already used.
- A generated file, `input-group.tsx`, a dependency of `cmdk`, had a
  `<div role="group">` with an `onClick` handler and no keyboard
  equivalent. `jsx-a11y` flagged this fault.

  We kept the code, with a comment that explains the reason. The
  `onClick` handler is a mouse-only convenience. The control under it
  stays fully reachable by keyboard on its own. We did not disable the
  check or work around it in silence.

## Testing

Vitest covers two layers. Pure logic — the math engine, row-building,
search and URL-parameter parsing, and FoV geometry — has plain unit
tests. Eight components — the two catalog browse grids, the catalog item
card, the compare selector, the compare-page swap-and-copy actions, the
navbar, the footer, and the last-updated badge — have React Testing
Library tests, run in a `jsdom` environment (`vitest.config.mts`). The
project has 122 tests, across 13 files, at last count.

Three interactive pieces still have no automated coverage: the diff
toggle, the field-of-view slider, and locale switching that keeps the
current query string. We checked this behavior through live browser
testing during development, not through automated tests. This repository
has no Playwright or other end-to-end coverage today. As a result, CI
cannot catch a regression in these three pieces the way it catches a
broken `getCropFactor` or a broken `CompareSelector` search.

## CI/CD

- **Pre-commit hook**, in `.husky/pre-commit`. A `prepare` script sets up
  the hook on `npm install`, so it works on any fresh clone. The hook
  runs `npm run validate`: type check, lint, format check, and unit
  tests. Lint uses `--max-warnings 0`, not only `0` errors. A test showed
  the reason: without this flag, one warning did not block the commit.
  The hook skips the production build, to keep local commits fast. CI
  does the build check instead.
- **CI**, in `.github/workflows/ci.yml`. CI runs the same checks, plus
  `next build`, on each pull request, and on each push to `main`. The
  build step needs a `DATABASE_URL` repository secret, since static
  generation for the catalog and product pages queries Postgres at
  build time, even though the build never writes to it.
- **Scraper CI**, in `.github/workflows/scraper.yml`. This workflow runs
  the Python pipeline in `scripts/scraper/`, on a schedule, and on a
  manual trigger with a dry-run option.

## Known limitations, and what a production version needs

This is a PoC. The catalog now comes from a real, scraper-fed Postgres
database, not a hand-written array, but each item in this list is still
open:

- The project needs automated end-to-end tests. Vitest and React Testing
  Library now cover eight components (see Testing above), but the diff
  toggle, the FoV slider, and locale switching still have no automated
  coverage, and there is no Playwright or other browser-driven suite.
- The project needs a `sitemap.xml` file.
- The project needs a dark-mode switch in the UI. The design system's
  tokens already support dark mode, but no control turns it on.
- The project needs a production value for `NEXT_PUBLIC_SITE_URL`, in
  `lib/site-config.ts`. This value defaults to `localhost` today.
- `getNativeCameraForLens`, in `lib/compare-data.ts`, picks the first
  camera on a lens's mount rather than a camera the user picked. See
  Data layer above. The real catalog now has more than one camera per
  mount, so this simplification is visible in production, not only in
  theory.
- `GET /api/dev/db-check` (`app/api/dev/db-check/route.ts`) is a
  temporary endpoint from an earlier migration step, kept only to prove
  the Postgres service layer returned real rows. Its own comment says to
  remove it once the catalog and product pages read through the same
  functions in normal page loads. They now do, so this endpoint is safe
  to delete.
