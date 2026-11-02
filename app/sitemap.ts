import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getAllCameras, getAllLenses } from "@/lib/services/equipment";
import { SITE_URL } from "@/lib/site-config";

const STATIC_PATHS = ["", "/cameras", "/lenses", "/compare"] as const;

// Backstop for a missed on-demand revalidateTag call, and for a build that
// ran without DATABASE_URL (which otherwise freezes a static-pages-only
// sitemap until the next deploy) — see lib/services/equipment.ts's
// EQUIPMENT_CACHE_REVALIDATE_SECONDS.
export const revalidate = 1209600; // 14 days

// One entry per locale, each listing every locale as an alternate, so
// crawlers can reach every page without walking the filter/compare query
// strings that robots.ts disallows.
function localizedEntries(
  path: string,
  lastModified?: Date,
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `${SITE_URL}/${locale}${path}`]),
  );
  return routing.locales.map((locale) => ({
    url: `${SITE_URL}/${locale}${path}`,
    lastModified,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = STATIC_PATHS.flatMap((path) => localizedEntries(path));

  if (!isDatabaseConfigured()) {
    console.warn("[sitemap] DATABASE_URL not set — listing static pages only.");
    return entries;
  }

  // Same cached reads as the listing pages (tagged "cameras"/"lenses"), so
  // building the sitemap costs no extra DB egress and /api/revalidate's
  // revalidateTag refreshes it after a scraper run.
  const [cameras, lenses] = await Promise.all([
    getAllCameras(),
    getAllLenses(),
  ]);

  // unstable_cache round-trips values through JSON, so on a cache hit
  // updatedAt is an ISO string despite its Date type — normalize it.
  return [
    ...entries,
    ...cameras.flatMap((camera) =>
      localizedEntries(`/cameras/${camera.slug}`, new Date(camera.updatedAt)),
    ),
    ...lenses.flatMap((lens) =>
      localizedEntries(`/lenses/${lens.slug}`, new Date(lens.updatedAt)),
    ),
  ];
}
