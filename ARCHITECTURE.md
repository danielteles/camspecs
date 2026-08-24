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

- The catalog browse pages, `/cameras` and `/lenses`, used to be static,
  for the same reason the product pages are. They are not static
  anymore. These two pages now read `searchParams`, to support faceted
  filtering (see "Catalog browse pages" below). Next.js treats a page as
  dynamic — server-rendered per request — once it reads `searchParams`.
  As a result, the `revalidate` export that used to sit on these two
  pages is gone. There is no static HTML left to revalidate.

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

The same file also exposes `getFilteredCameras`/`getFilteredLenses`, and
the query builders behind them, `buildCamerasQuery`/`buildLensesQuery`.
Each builder takes a plain `CameraFilters`/`LensFilters` object. It
chains one Kysely `.where()` call per set filter onto a `SELECT`. As a
result, every filter combination compiles to one parameterized query,
not N round trips and not an in-memory scan. `getAllCameras`/
`getAllLenses` are themselves just the filtered variant, called with no
filters — one code path, not two. Sort keys go through a fixed
`Record<SortKey, Column>` lookup, not a raw column name. As a result, a
sort parameter can never reach `ORDER BY` as arbitrary SQL.

We test these builders by compiling them against a real Postgres SQL
compiler, with no live connection. `test/kysely-test-db.ts` builds a
Kysely instance from `PostgresAdapter`, `PostgresIntrospector`, and
`PostgresQueryCompiler`, plus a `DummyDriver`. As a result, `.compile()`
produces the exact SQL and bound parameters a real query uses, without
opening a socket. This project has no test-database container. This
compile-only technique is the whole answer to the question "does the
WHERE clause produce the right SQL" — a deliberate choice, not a gap.
See `lib/services/equipment.test.ts`.

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
`app/[locale]/lenses/page.tsx`) support faceted filtering. Cameras
filter by brand, sensor format, mount, resolution, and weight. Lenses
filter by brand, mount, prime/zoom, focal length, and max aperture.
Every filter's state lives in the URL query string (see README.md's
"Catalog filtering" section for the exact parameter schema). The design
splits cleanly along one line: **the server decides which items match.
The client decides which options to show, and how many of each.**

- Each page is a Server Component. It reads `searchParams`, and parses
  it into a `CameraFilters`/`LensFilters` object with
  `lib/catalog-params.ts`. It passes that object straight to
  `getFilteredCameras`/`getFilteredLenses`. As a result, a visitor sees
  the output of a real SQL `WHERE` clause, not a client-side filter over
  a fetched array. The page also fetches the _unfiltered_ catalog once,
  in parallel, and passes both arrays down to a Client Component,
  `CamerasCatalog` or `LensesCatalog`.

- The Client Component never re-implements the SQL filter to decide
  what to render. The `cameras`/`lenses` prop it received is already
  the answer. It does compute one thing client-side, from the
  unfiltered array: each facet's available options, and their counts.
  `lib/catalog-filtering.ts` holds `cameraMatchesFilters`/
  `lensMatchesFilters`, a plain-TypeScript mirror of the SQL builders'
  WHERE rules. It also holds `countByFacet`, which counts items per
  facet value **as if every filter except that one facet still
  applied**. This is the standard faceted-search rule. Filtering to
  Sony still shows "Fujifilm (5)" as an available next click, not a
  disabled zero — the Fujifilm count excludes only the brand filter,
  not the others. A wrong version of this rule is the most common way a
  faceted filter UI feels broken. For this reason,
  `lib/catalog-filtering.test.ts` tests this logic on its own,
  independent of any component.

- The two arrays exist for one reason. A count computed from the
  already-filtered set reflects only the current filters, not the
  effect of adding one more. The catalogs here are small — tens to low
  hundreds of rows — so shipping the full array to the client is a
  deliberate, cheap trade for this purpose. See "Known limitations"
  below for what changes once that stops being true.

- Filter state flows through `useSearchParams()` to read, and
  `router.replace({ pathname, query }, { scroll: false })` to write.
  This is the same pattern `CompareSelector` already used, through
  `@/i18n/navigation` (see "Internationalization" above for why the
  query object cannot include an explicit `undefined`). The app wraps
  the `router.replace` call in `startTransition`, so `isPending` can
  dim the results grid while the server round-trip for the new
  `searchParams` is in flight. The facet panel itself updates right
  away — its counts come from the client-held unfiltered array, not
  from that round trip. See "Loading feedback" below for the spinner,
  skeleton, and accessibility markup built on top of this `isPending`
  flag.

- A range slider (`<FilterSidebar />`'s `"range"` section, backed by
  Radix `Slider`) encodes "no filter" as one specific position: the
  dataset's own bound. Minimum resolution starts at the catalog's
  lowest megapixel count. Maximum weight starts at its highest gram
  count, and so on for each range facet. Each `onChange` handler
  compares the new value against that bound before it writes to the
  URL. A value that lands back on the bound becomes `undefined`, not a
  literal, redundant filter. Without this rule, the first drag of any
  slider adds a URL parameter and an active-filter badge, even one that
  changes nothing.

- `FilterSidebar`, `MobileFilterDrawer`, and `ActiveFilterBadges`
  (`components/`) are presentational: every string they render is a
  prop, and neither calls `useTranslations` itself. `CamerasCatalog`/
  `LensesCatalog` are the only place that resolves i18n keys and turns
  filter state into the section/chip configs these components take.
  This keeps the same three components usable, unchanged, for the
  cameras and lenses catalogs even though the two have almost no facets
  in common.

- The free-text search box still layers on top of the server-filtered
  array, client-side only, the same way it always did. It was never
  part of the URL-driven filter set this step added. Adding it means
  either a debounced `ILIKE` round trip on every keystroke, or a
  second, parallel client-side filtering path next to the SQL one.
  Neither is implemented. See "Known limitations" below.

A user reaches a product page from a card built by the shared
`CatalogItemCard` component. The same card also adds the item to a
comparison directly. Both actions worked the same way before this
feature existed.

## Loading feedback

This section explains the loading feedback that the catalog pages and
the compare page give the user, and the code behind each part.

### Filter and selector clicks

`CamerasCatalog` and `LensesCatalog` (`components/cameras-catalog.tsx`,
`components/lenses-catalog.tsx`) already wrap their `router.replace`
call in React's `useTransition` hook. That call updates the URL with
the new filter state. `useTransition` returns an `isPending` flag
while that update runs in the background.

`FilterSidebar` and `MobileFilterDrawer`
(`components/filter-sidebar.tsx`, `components/mobile-filter-drawer.tsx`)
accept this `isPending` flag as a prop. Each renders a small spinner
(`components/ui/spinner.tsx`) next to the filter list while
`isPending` is true. The results grid dims to 50% opacity, and gets
`pointer-events-none`, so a user cannot click a stale card while new
results load.

The compare page (`app/[locale]/compare/page.tsx`) needs a different
approach. `CompareSelector`, `CompareActions`, and the results table
are three separate Client Components around one server-rendered page.
A single `useTransition` call inside one component cannot reach the
other two. `CompareTransitionProvider`
(`components/compare-transition-provider.tsx`) shares one
`useTransition` between all three, through React Context.
`CompareSelector` and `CompareActions` both read this context, instead
of each running its own `useTransition`. `CompareTableOverlay`
(`components/compare-table-overlay.tsx`) reads the same `isPending`
flag, and blurs and dims the results while any of the three components
triggers a change.

`CompareSelector`'s search combobox also shows its own spinner.
`CommandInput` (`components/ui/command.tsx`) accepts an `isLoading`
prop, and swaps its search icon for a spinner while the debounced
`/api/search` fetch is in flight.

### Skeleton cards on page load

If a route has a `loading.tsx` file, Next.js shows this fallback while
the page's Server Component data fetch is in flight.
`app/[locale]/cameras/loading.tsx` and `app/[locale]/lenses/loading.tsx`
add this fallback for the catalog pages. Each file renders a full page
skeleton: a title bar, a search bar, a sidebar, and a grid of card
skeletons.

`EquipmentCardSkeleton` (`components/equipment-card-skeleton.tsx`)
matches the layout of a real `CatalogItemCard`: the same border,
padding, and bar heights. `CatalogGridSkeleton`
(`components/catalog-grid-skeleton.tsx`) renders six of these in the
same grid layout as the real results. Because the skeleton matches the
real layout, the page does not jump once real data replaces it.

### Accessibility

Every loading region in this feature carries two attributes together:
`aria-busy="true"` and `aria-live="polite"`. This pairing is
deliberate, not automatic. `aria-busy` tells a screen reader to wait
before it announces changes inside the region. `aria-live="polite"`
tells the screen reader to announce the region once it is no longer
busy. Together, they announce one final update, not every small change
inside the region.

`CatalogGridSkeleton` also renders a visually hidden `sr-only` label,
for example "Loading cameras…", inside its `role="status"` container.
`FilterSidebar` renders a similar label next to its spinner. A screen
reader announces this label, even though a sighted user only sees the
spinner.

## Scraper pipeline

`scripts/scraper/` holds a separate Python system. It fetches camera and
lens data from external sources, merges and cleans the records, and
writes them to the Postgres database the app reads from. See
`scripts/scraper/README.md` for setup, usage, and full detail.

The pipeline has five stages, in `main.py`: fetch, merge, validate,
upsert, and revalidate. Three extractors run in the fetch stage, each
from a different source. The sources are a structured public data
source, a scrape of manufacturer product pages, and a scrape of a
third-party specifications site. Each extractor is its own module in
`extractors/`.

**Finding every product.** The specifications site hides most of its
catalog behind a "Show more" button on each brand section.
`extractors/versus.py`'s discovery functions click every button on both
its camera page and its lens page, before they read the product list. A
page load with no clicks shows about 130 products, out of more than
1,800 that exist. Pass `--discover-versus-slugs` to `main.py` to run
this step, and add its results to the fixed slug list already there.

**A gap before the merge.** `mount` on a raw fetched record can be
empty. One example is a checked case where the specifications site's
own page has no mount value for a real interchangeable-lens camera.
Before the merge stage runs, `apply_curated_mount_overrides` fills in
`mount` for each checked case. This step must run first, since the
merge stage groups records by mount.

**Merging records.** `merger.py` combines records for the same item,
from each source, into one record. `merge_key` groups records by mount
plus a normalized brand-and-model string. A cosmetic difference between
sources, for example one source's "Z6III" against another's "Z6 III",
still matches to one item. `normalize_brand` and
`strip_redundant_brand_prefix` (`models/parsers.py`) clean the brand and
model text first. This stops a legal company name, for example "Sony
Group", from splitting one real item into two records. It also stops a
repeated brand name, for example "Canon EOS R10", from doing the same.

Within a group, a priority order decides each field. A manufacturer
record (`source` prefixed `manufacturer:`) wins over the specifications
site's record. The specifications site's record wins over the
structured source's record. An empty field on the winning record fills
in from the next source in that order.

The merge stage runs four more steps after this priority merge, each in
`transformers/merger.py` or `transformers/sensor_fallback.py`:

- One step fills in `sensor_format` for three mounts where it is a fixed
  physical fact (Micro Four Thirds, Fujifilm X, Fujifilm G). The
  structured source has no populated sensor-format value for any camera.
- One step removes a merged camera record that is still stuck at
  `"other"` sensor format, and came only from the structured source. No
  later step can resolve this record to a real sensor format. Keeping
  this record only adds a row nobody can ever see.
- `backfill_sensor_dimensions` fills in exact sensor width and height,
  in millimeters, for a record with a known sensor format but no exact
  measurement from any source. Canon's APS-C sensor gets its own entry
  in this table, since it is smaller than every other maker's APS-C
  sensor by close to 5%.
- One step fills in a release year for a small, named list of lens kits
  and one camera. Each entry is checked against the structured source,
  with no release-date value at all.

`extractors/curated_fallbacks.py` holds the lookup tables these steps
read from. Each entry names its source in a comment. This keeps a
hand-written fact traceable, instead of mixing it silently into the
scraped data.

The upsert stage writes each record to Postgres, through SQLAlchemy and
asyncpg. A new item inserts as a new row. An existing item updates only
its empty columns. A later scrape never replaces a value that a person,
or an earlier scrape, already checked.

The final stage calls a new API route, `POST /api/revalidate`
(`app/api/revalidate/route.ts`). This route checks a shared secret, then
clears the ISR cache for each camera and lens page the pipeline touched.
Without this call, a change waits for the existing 1-hour `revalidate`
window to expire on its own. A failed revalidation call does not fail
the pipeline, since Postgres already holds the data by this stage.

On the read side, `lib/services/equipment.ts` shows a camera or lens
when one display fact is missing, for example its release year or its
megapixel count. It still drops a record with an unsupported mount. It
also drops a camera with no sensor size, since the equivalence
calculator needs a real sensor size to run.

`.github/workflows/scraper.yml` runs the pipeline on a schedule, and on
a manual trigger with a dry-run option.

`scripts/scraper/tests/test_versus_discovery_integration.py` runs
against the live specifications site, and checks that each major brand
still returns at least a fixed minimum count of products. This test
catches a future regression in the discovery step.

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

Vitest covers two layers. Pure logic has plain unit tests: the math
engine, row-building, search and URL-parameter parsing, FoV geometry,
the catalog SQL query builders, and the faceted-search filter and count
rules. The query builders compile against a real Postgres compiler,
with no live connection (see "Data layer" above). Eleven components
have React Testing Library tests, run in a `jsdom` environment
(`vitest.config.mts`): the two catalog browse grids, the catalog item
card, the compare selector, the compare-page swap-and-copy actions, the
navbar, the footer, the last-updated badge, and the three filter
components (`FilterSidebar`, `MobileFilterDrawer`, `ActiveFilterBadges`).
The project has 196 tests, across 19 files, at last count.

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
  Library now cover eleven components (see Testing above). The diff
  toggle, the FoV slider, and locale switching still have no automated
  coverage. There is no Playwright or other browser-driven suite.
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
- The app computes faceted filter option counts client-side (see
  "Catalog browse pages" above), against the full, unfiltered catalog
  fetched alongside the filtered results. This is a deliberate trade
  for catalogs this size — tens to low hundreds of rows — not an
  oversight. It stops being a good trade well before the catalog
  reaches thousands of rows. At that point, the counts need a real
  aggregate query instead — `GROUP BY` per facet, filtered by every
  other active facet — rather than a second array shipped to the
  browser.
- The free-text search box on `/cameras` and `/lenses` still filters
  client-side only, on top of the server-filtered results. It is not
  part of the URL-driven filter state the other facets got. It was
  already client-side before faceted filtering existed. Adding it to
  that filter state means either a debounced query round trip on every
  keystroke, or a second in-memory filtering path next to the SQL one.
  Both are real options. Neither is implemented yet.
