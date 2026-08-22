import type { NextRequest } from "next/server";

import { buildCatalog, resolveCatalogSlugs, searchCatalog } from "@/lib/search";
import { getAllCameras, getAllLenses } from "@/lib/services/equipment";

const MAX_RESULTS = 8;

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

    return Response.json({ results: resolveCatalogSlugs(catalog, slugs) });
  }

  const query = searchParams.get("q") ?? "";
  const results = searchCatalog(catalog, query).slice(0, MAX_RESULTS);

  return Response.json({ results });
}
