import { createHash, timingSafeEqual } from "node:crypto";

import { revalidatePath, revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Hashing first gives timingSafeEqual the equal-length inputs it requires,
// so neither the comparison time nor an early length check leaks how much
// of the secret a guess got right.
function isSameSecret(provided: string, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(secret));
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
// changed camera/lens rows, so the 14-day ISR window (see `revalidate` in
// the [slug] pages) doesn't leave stale data up until it expires.
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
  if (provided === null || !isSameSecret(provided, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json(
      { error: "Body must be a JSON object" },
      { status: 400 },
    );
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
  // Invalidates the cached DB reads from lib/services/equipment.ts (footer,
  // search, listing pages, opengraph images, etc.) — revalidatePath above
  // only covers the individual [slug] pages, not everywhere else those
  // cached queries are used. { expire: 0 } (rather than the "max"
  // stale-while-revalidate profile) since this route is called by an
  // external webhook that needs the change visible immediately, matching
  // revalidatePath's immediate-expiry semantics above.
  if (cameraSlugs.length > 0) {
    revalidateTag("cameras", { expire: 0 });
  }
  if (lensSlugs.length > 0) {
    revalidateTag("lenses", { expire: 0 });
  }

  return Response.json({ revalidated: true, paths });
}
