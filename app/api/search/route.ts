import type { NextRequest } from "next/server";

import { buildCatalog, resolveCatalogSlugs, searchCatalog } from "@/lib/search";
import { getAllCameras, getAllLenses } from "@/lib/services/equipment";

const MAX_RESULTS = 8;

// The autocomplete fires on every debounced keystroke, and results only
// change when the scraper runs (roughly every two weeks). Letting the CDN
// cache each ?q=/?slugs= response means repeated queries never reach a
// function. The CDN isn't purged by /api/revalidate, so s-maxage is kept
// short: after a scraper run, results are at most about an hour stale.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slugsParam = searchParams.get("slugs");

  const [cameras, lenses] = await Promise.all([
    getAllCameras(),
    getAllLenses(),
  ]);
  const catalog = buildCatalog(cameras, lenses);

  if (slugsParam !== null) {
    const slugs = slugsParam
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);

    return Response.json(
      { results: resolveCatalogSlugs(catalog, slugs) },
      { headers: CACHE_HEADERS },
    );
  }

  const query = searchParams.get("q") ?? "";
  const results = searchCatalog(catalog, query).slice(0, MAX_RESULTS);

  return Response.json({ results }, { headers: CACHE_HEADERS });
}
