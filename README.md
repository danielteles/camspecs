[`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) created this [Next.js](https://nextjs.org) project.

## Architecture: supported mounts

CamSpecs covers **current mirrorless interchangeable-lens systems only**. This excludes DSLR and other legacy mounts, such as Canon EF, Nikon F, and Sony A-mount. This exclusion is a deliberate product decision, not a missing feature.

| Mount             | `MountId`           | Flange distance |
| ----------------- | ------------------- | --------------- |
| Canon RF          | `canon-rf`          | 20.0 mm         |
| Nikon Z           | `nikon-z`           | 16.0 mm         |
| Sony E            | `sony-e`            | 18.0 mm         |
| Fujifilm X        | `fujifilm-x`        | 17.7 mm         |
| Fujifilm G        | `fujifilm-g`        | 26.7 mm         |
| Micro Four Thirds | `micro-four-thirds` | 19.25 mm        |
| L-Mount           | `l-mount`           | 20.0 mm         |
| Leica M           | `leica-m`           | 27.95 mm        |

**Why mirrorless-only:** the site's core value is crop-factor and field-of-view equivalence across systems. This matters most to buyers who compare current mirrorless systems. Every mount in the table above is still in active production. Legacy DSLR mounts are not in active production. A mirrorless-comparison tool with a decades-deep DSLR catalog dilutes the comparison instead of serving this use case.

Fujifilm G is included on this same basis. It is a currently produced mirrorless medium-format system (Fujifilm GFX), not a legacy mount. Its `sensor_format` is `medium-format`. `scripts/scraper/transformers/sensor_fallback.py` already backfills this value to the real GFX sensor size (43.8 × 32.9 mm).

Leica M is included on the same basis. It is a currently produced digital rangefinder system with no reflex mirror, for example M11 and M10-P. Leica still makes new M-mount bodies, so M-mount is not a legacy mount either.

**Where this is enforced:** three independent points enforce this rule. An unsupported mount never reaches a user at these points:

- The scraper's structured-data extractor, in `scripts/scraper/extractors/`, only queries for items that use one of these mount identifiers. As a result, no other mount enters the pipeline from this source.
- `lib/types.ts`'s `MountId` union and `lib/mounts.ts`'s `MOUNTS` registry are the only place the frontend can represent mount values.
- `lib/services/equipment.ts` logs and skips a row with an unsupported mount value, instead of showing it. This check exists because the Postgres `mount` column has no enum constraint. It is a plain `String` in `scripts/scraper/db/schema.py`'s `CameraRecord`/`LensRecord`. A future source or a manual insert can write an unsupported mount value, so the frontend checks the value again instead of trusting the schema.

**If DSLR support is ever added**, it needs new entries at all three enforcement points above. It also needs mount-specific flange-distance data and new per-mount scrape targets in `scripts/scraper/main.py`'s `DEFAULT_*_SLUGS`/`DEFAULT_*_URLS` lists. We curate these targets per mount. We do not crawl them in a generic way.

## Getting Started

The catalog pages get their data from Postgres. Before you start the
server, set up a database connection.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy the example environment file. Fill in a real `DATABASE_URL`.

   ```bash
   cp .env.example .env.local
   ```

   See `scripts/scraper/README.md` for how to populate this database with
   real camera and lens data. If `DATABASE_URL` is not set, the app still
   runs, but the catalog and product pages render empty.

3. Run the development server.

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

The home page is `app/[locale]/page.tsx`. Every route lives under the
`[locale]` segment, for example `app/[locale]/cameras/page.tsx`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Catalog filtering

`/cameras` and `/lenses` support faceted filtering. Every filter is a URL
query parameter. A filtered view is a plain link. You can copy it, send
it, or bookmark it. It always opens to the same results. For example:

```
/en/cameras?sensor=full-frame&brand=Sony&min_megapixels=24
```

The server reads filters and applies them as a real SQL `WHERE` clause
(`lib/services/equipment.ts`). The browser does not filter results again.
The app computes facet option counts, for example "Sony (3)", against the
full catalog. As a result, a count is correct even before you select a
checkbox.

**`/cameras` parameters:**

| Parameter        | Format                         | Example                   |
| ---------------- | ------------------------------ | ------------------------- |
| `brand`          | comma-separated list           | `brand=Sony,Fujifilm`     |
| `sensor`         | comma-separated `SensorFormat` | `sensor=full-frame,aps-c` |
| `mount`          | comma-separated `MountId`      | `mount=sony-e`            |
| `min_megapixels` | number                         | `min_megapixels=24`       |
| `max_weight`     | number, grams                  | `max_weight=700`          |

**`/lenses` parameters:**

| Parameter                 | Format                                                       | Example                     |
| ------------------------- | ------------------------------------------------------------ | --------------------------- |
| `brand`                   | comma-separated list                                         | `brand=Sony`                |
| `mount`                   | comma-separated `MountId`                                    | `mount=sony-e`              |
| `focal_type`              | `prime` or `zoom`                                            | `focal_type=prime`          |
| `min_focal` / `max_focal` | number, mm (matches a lens whose range overlaps this window) | `min_focal=24&max_focal=70` |
| `max_aperture`            | number (f-number, lower = faster)                            | `max_aperture=2.8`          |

You can omit a parameter, or combine several parameters freely. The app
treats an unset or invalid value as "no filter," not as an error. See
`lib/catalog-params.ts` for the parsing and serialization rules. See
`ARCHITECTURE.md`'s "Catalog browse pages" section for how filter state
flows from the URL to the SQL query.

## Loading feedback

The catalog pages and the compare page show visual feedback while new
data loads. This section explains the three parts of that feedback.

**Filter clicks.** When you click a filter checkbox or drag a slider,
the app does not freeze the screen. React's `useTransition` hook marks
the URL update as a background update. A spinner appears next to the
filter panel while the update runs, and the results grid dims. You can
still see the old results while the app fetches the new ones.

**Skeleton cards on page load.** When you open `/cameras` or `/lenses`,
or refresh the page, Next.js shows placeholder cards first. These are
called skeleton cards. Each skeleton card matches the size of a real
camera or lens card. The real cards replace the skeletons once the
server sends the data. This keeps the page layout stable, and prevents
a blank screen.

**Accessibility.** Screen readers need to know when content is
loading. The app adds two attributes to each loading region:
`aria-busy="true"` and `aria-live="polite"`. The `aria-busy` attribute
tells a screen reader to wait before it announces changes. The
`aria-live` attribute tells the screen reader to announce the region
once it is no longer busy. Together, they announce one final update,
not every small change.

The compare page uses the same pattern. A spinner appears in the
search box while it looks for matching cameras and lenses. The
comparison table blurs and dims while you swap items or add a new one.

See `ARCHITECTURE.md`'s "Loading feedback" section for the exact files
and components behind this behavior.

## Learn More

For more about Next.js, see these resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can visit [the Next.js GitHub repository](https://github.com/vercel/next.js). Feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
