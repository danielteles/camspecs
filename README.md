This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Architecture: supported mounts

CamSpecs is scoped to **current mirrorless interchangeable-lens systems only**. DSLR and other legacy mounts (Canon EF, Nikon F, Sony A-mount, etc.) are intentionally excluded — this is a deliberate product decision, not a gap to be filled.

| Mount             | `MountId`           | Flange distance |
| ----------------- | ------------------- | --------------- |
| Canon RF          | `canon-rf`          | 20.0 mm         |
| Nikon Z           | `nikon-z`           | 16.0 mm         |
| Sony E            | `sony-e`            | 18.0 mm         |
| Fujifilm X        | `fujifilm-x`        | 17.7 mm         |
| Fujifilm G        | `fujifilm-g`        | 26.7 mm         |
| Micro Four Thirds | `micro-four-thirds` | 19.25 mm        |
| L-Mount           | `l-mount`           | 20.0 mm         |

**Why mirrorless-only:** the site's core value — crop-factor and field-of-view equivalence across systems — matters most to buyers actively choosing among current mirrorless systems. Every mount above is still in active production; legacy DSLR mounts are not, and mixing a decades-deep DSLR catalog into a mirrorless-comparison tool would dilute rather than serve that use case. Fujifilm G is included on this basis too — it's a currently-produced mirrorless medium-format system (Fujifilm GFX), not a legacy mount; its `sensor_format` is `medium-format`, already backfilled to the real GFX sensor size (43.8 × 32.9 mm) by `scripts/scraper/transformers/sensor_fallback.py`.

**Where this is enforced** (three independent points — a mount unsupported at any one of them never reaches a user):

- The scraper's structured-data extractor, in `scripts/scraper/extractors/`, only queries for items using one of these mount identifiers, so nothing else enters the pipeline from that source in the first place.
- `lib/types.ts`'s `MountId` union and `lib/mounts.ts`'s `MOUNTS` registry — the only mount values the frontend can represent at all.
- `lib/services/equipment.ts`'s `MOUNT_IDS` — the DB read boundary: a row with any other mount value is logged and skipped rather than shown. This exists because the Postgres `mount` column itself has no enum constraint (a plain `String` in `scripts/scraper/db/schema.py`'s `CameraRecord`/`LensRecord`) — nothing at the database level stops a future source or manual insert from writing an unsupported mount, so the frontend re-checks rather than trusting the schema.

**If DSLR support is ever added**, it needs new entries at all three enforcement points above, plus mount-specific flange-distance data and new per-mount scrape targets in `scripts/scraper/main.py`'s `DEFAULT_*_SLUGS`/`DEFAULT_*_URLS` lists (these targets are curated per-mount, not crawled generically).

## Getting Started

The catalog pages read from Postgres, so set up a database connection
before you start the server.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy the example environment file, and fill in a real `DATABASE_URL`.

   ```bash
   cp .env.example .env.local
   ```

   See `scripts/scraper/README.md` for how to populate this database with
   real camera and lens data. Without `DATABASE_URL` set, the app still
   runs, but the catalog and product pages render empty.

3. Run the development server.

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

The home page is `app/[locale]/page.tsx`. Every route lives under the
`[locale]` segment, for example `app/[locale]/cameras/page.tsx`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
