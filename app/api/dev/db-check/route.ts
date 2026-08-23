import { getAllCameras, getAllLenses } from "@/lib/services/equipment";

// Temporary verification endpoint for Step 1 of the DB migration — confirms
// the service layer reads real rows from Postgres. Remove once catalog/detail
// pages (Steps 2-3) exercise the same functions in normal page loads.
export async function GET() {
  const [cameras, lenses] = await Promise.all([
    getAllCameras(),
    getAllLenses(),
  ]);

  return Response.json({
    cameraCount: cameras.length,
    lensCount: lenses.length,
    sampleCamera: cameras[0] ?? null,
    sampleLens: lenses[0] ?? null,
  });
}
