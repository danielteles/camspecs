import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { OgCard } from "@/components/og-card";
import {
  buildComparisonRows,
  getFormattedRowValue,
  type ComparisonItem,
} from "@/lib/compare-data";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getAllCameras, getCameraBySlug } from "@/lib/services/equipment";

export const alt = "Camera specifications";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  if (!isDatabaseConfigured()) {
    console.warn(
      "[opengraph-image] DATABASE_URL not set — skipping static generation for camera OG images.",
    );
    return [];
  }
  const cameras = await getAllCameras();
  return cameras.map((camera) => ({ slug: camera.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });

  const camera = await getCameraBySlug(slug);

  if (!camera) {
    return new ImageResponse(
      <OgCard
        eyebrow={t("Common.siteName")}
        title={t("Metadata.title")}
        subtitle=""
        specs={[]}
      />,
      { ...size },
    );
  }

  const item: ComparisonItem = { type: "camera", ...camera };
  const rows = buildComparisonRows([item]);
  const value = (rowId: string) => getFormattedRowValue(rows, rowId, 0, t);

  return new ImageResponse(
    <OgCard
      eyebrow={`${t("Common.siteName")} · ${t("CompareSelector.typeCamera")}`}
      title={`${item.brand} ${item.model}`}
      subtitle={t("ProductPage.specsHeading")}
      specs={[
        { label: t("ComparePage.rows.mount"), value: value("mount") },
        {
          label: t("ComparePage.rows.sensorFormat"),
          value: value("sensorFormat"),
        },
        {
          label: t("ComparePage.rows.cropFactor"),
          value: value("cropFactor"),
        },
        {
          label: t("ComparePage.rows.megapixels"),
          value: value("megapixels"),
        },
      ]}
    />,
    { ...size },
  );
}
