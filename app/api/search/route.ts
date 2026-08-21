import type { NextRequest } from "next/server";

import { resolveCatalogSlugs, searchCatalog } from "@/lib/search";

const MAX_RESULTS = 8;

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slugsParam = searchParams.get("slugs");

  if (slugsParam !== null) {
    const slugs = slugsParam
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);

    return Response.json({ results: resolveCatalogSlugs(slugs) });
  }

  const query = searchParams.get("q") ?? "";
  const results = searchCatalog(query).slice(0, MAX_RESULTS);

  return Response.json({ results });
}
