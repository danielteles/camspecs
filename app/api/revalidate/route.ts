import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";

interface RevalidateRequestBody {
  cameras?: unknown;
  lenses?: unknown;
}

function toSlugList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

// Called by the scraper pipeline (scripts/scraper/) after it upserts new or
// changed camera/lens rows, so the 1-hour ISR window (see `revalidate` in
// the [slug] pages) doesn't leave stale data up for up to an hour.
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATION_SECRET;
  if (!secret) {
    return Response.json(
      { error: "REVALIDATION_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (provided !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RevalidateRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cameraSlugs = toSlugList(body.cameras);
  const lensSlugs = toSlugList(body.lenses);

  const paths: string[] = [];
  for (const locale of routing.locales) {
    for (const slug of cameraSlugs) {
      paths.push(`/${locale}/cameras/${slug}`);
    }
    for (const slug of lensSlugs) {
      paths.push(`/${locale}/lenses/${slug}`);
    }
  }
  for (const path of paths) {
    revalidatePath(path);
  }

  return Response.json({ revalidated: true, paths });
}
