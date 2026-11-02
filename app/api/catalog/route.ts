import { isDatabaseConfigured } from "@/lib/db/client";
import { buildCatalog } from "@/lib/search";
import { getAllCameras, getAllLenses } from "@/lib/services/equipment";

// The compare selector's search index (see components/use-search-catalog.ts).
// Prerendered and served as a static file, so buildCatalog runs only when
// the route regenerates. Its reads are tagged "cameras"/"lenses", so
// /api/revalidate's revalidateTag regenerates it after a scraper run.
export const dynamic = "force-static";

// Backstop for a missed on-demand revalidateTag call, and for a build that
// ran without DATABASE_URL — see lib/services/equipment.ts's
// EQUIPMENT_CACHE_REVALIDATE_SECONDS.
export const revalidate = 1209600; // 14 days

export async function GET() {
  if (!isDatabaseConfigured()) {
    console.warn(
      "[api/catalog] DATABASE_URL not set — serving an empty catalog.",
    );
    return Response.json({ items: [] });
  }

  const [cameras, lenses] = await Promise.all([
    getAllCameras(),
    getAllLenses(),
  ]);

  return Response.json({ items: buildCatalog(cameras, lenses) });
}
