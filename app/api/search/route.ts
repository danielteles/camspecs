import type { NextRequest } from "next/server";

import { buildCatalog, resolveCatalogSlugs, searchCatalog } from "@/lib/search";
import { getAllCameras, getAllLenses } from "@/lib/services/equipment";

const MAX_RESULTS = 8;

// Results only change on scraper runs, so the CDN can answer repeated
// queries. /api/revalidate doesn't purge it: a hot query is about an hour
// stale at most, a rarely-typed one up to a day (stale-while-revalidate).
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
} satisfies HeadersInit;

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
