# Architecture

CamSpecs is a proof-of-concept (PoC) platform for camera and lens
comparison, with a dynamic equivalence calculator. The project is a
technical portfolio piece. This document explains the technical decisions
behind the code, and the reasons for them.

## Stack

| Concern              | Choice                                                         |
| -------------------- | -------------------------------------------------------------- |
| Framework            | Next.js 16 (App Router, Turbopack)                             |
| Language             | TypeScript, `strict: true`                                     |
| UI runtime           | React 19                                                       |
| Styling              | Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)    |
| Component primitives | shadcn/ui on **Radix UI** + `cmdk`                             |
| i18n                 | next-intl (`en`, `pt-BR`)                                      |
| Testing              | Vitest                                                         |
| Git hooks            | Husky                                                          |
| CI                   | GitHub Actions                                                 |
| Data pipeline        | Python (`scripts/scraper/`) — Pydantic, SQLAlchemy, Playwright |

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
  (Incremental Static Regeneration). The mock catalog never changes at
  runtime, so this revalidation window has no visible effect today. It
  shows the pattern for a catalog fed by a real backend.

## Internationalization

next-intl handles routing, for example `/en/...` and `/pt-BR/...`, through
`proxy.ts`. It also handles message loading.

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

`lib/mock-data.ts` holds a small catalog in memory. The catalog has 3
cameras, one each for full-frame, APS-C, and Micro Four Thirds sensors.
It also has 3 lenses, one for each camera mount. Each lens pairs with
exactly one camera, on the same mount.

This 1-to-1 pairing makes lens equivalence possible to compute. A lens
has no sensor of its own. `getNativeCameraForLens`, in
`lib/compare-data.ts`, finds the camera in the catalog with the same
mount, and uses that camera's crop factor.

A real product needs a different design here. In a real product, one
mount maps to many camera bodies. The user picks a body, instead of the
app inferring one. This document names this PoC simplification directly,
instead of leaving it hidden.

Every part of the app that reads the catalog uses one of a small set of
pure functions. Each function has its own tests. This avoids ad hoc
lookups spread across many pages.

`lib/search.ts` holds `searchCatalog` and `resolveCatalogSlugs`. This is
a small index of brand, model, and mount. `/api/search` and the chips of
the selector use it.

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

## Scraper pipeline

`scripts/scraper/` holds a separate Python system. It fetches camera and
lens data from external sources, and stores clean records in a Postgres
database. This system is the planned real data source for the app, in
place of the static catalog in `lib/mock-data.ts`. See
`scripts/scraper/README.md` for setup and usage.

The pipeline has five stages, in `main.py`: fetch, merge, validate,
upsert, and revalidate. Two extractors run in the fetch stage today: a
Wikidata SPARQL query, and a Playwright scraper for Nikon's product
pages.

`merger.py` combines records for the same item, from each source, into
one record. A manufacturer record wins a conflict over a Wikidata record.
An empty field on the winning record fills in from the other source.

The upsert stage writes each record to Postgres, through SQLAlchemy and
asyncpg. A new item inserts as a new row. An existing item updates only
its empty columns. A later scrape never overwrites a value that a
person, or an earlier scrape, already validated.

The final stage calls a new API route, `POST /api/revalidate`
(`app/api/revalidate/route.ts`). This route checks a shared secret, then
clears the ISR cache for each camera and lens page the pipeline touched.
Without this call, a change waits for the existing 1-hour `revalidate`
window to expire on its own.

`.github/workflows/scraper.yml` runs the pipeline on a schedule, and on a
manual trigger with a dry-run option.

The app's data layer must still switch from `lib/mock-data.ts` to
Postgres. This remains open, and appears again in Known limitations
below.

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

Vitest tests only pure logic: the math engine, row-building, search and
URL-parameter parsing, and FoV geometry. The project has 88 tests, at
last count.

Component and interaction behavior has a real gap in coverage. This
includes keyboard navigation through the combobox, the diff toggle, the
FoV slider, and locale switching that keeps state. We checked this
behavior through live browser testing during development, not through
automated component tests. This repository has no Testing Library or
Playwright coverage today. As a result, CI cannot catch a UI regression
the way it catches a broken `getCropFactor`.

## CI/CD

- **Pre-commit hook**, in `.husky/pre-commit`. A `prepare` script sets up
  the hook on `npm install`, so it works on any fresh clone. The hook
  runs `npm run validate`: type check, lint, format check, and unit
  tests. Lint uses `--max-warnings 0`, not only `0` errors. A test showed
  the reason: without this flag, one warning did not block the commit.
  The hook skips the production build, to keep local commits fast. CI
  does the build check instead.
- **CI**, in `.github/workflows/ci.yml`. CI runs the same checks, plus
  `next build`, on each pull request, and on each push to `main`.
- **Scraper CI**, in `.github/workflows/scraper.yml`. This workflow runs
  the Python pipeline in `scripts/scraper/`, on a schedule, and on a
  manual trigger with a dry-run option.

## Known limitations, and what a production version needs

This is a PoC, with a hand-written catalog in memory. A production
version needs each item in this list:

- The project needs to wire the app's data layer to the new scraper
  pipeline's Postgres database, in place of `lib/mock-data.ts`. See
  Scraper pipeline above.
- The project needs automated UI and end-to-end tests.
- The project needs a `sitemap.xml` file.
- The project needs a browse page for the catalog. Today, a user reaches
  a product page only through search or a cross-link, not a browse
  index.
- The project needs a dark-mode switch in the UI. The design system's
  tokens already support dark mode, but no control turns it on.
- The project needs a production value for `NEXT_PUBLIC_SITE_URL`, in
  `lib/site-config.ts`. This value defaults to `localhost` today.
