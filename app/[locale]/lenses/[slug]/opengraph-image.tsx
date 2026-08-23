import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { OgCard } from "@/components/og-card";
import {
  buildComparisonRows,
  getFormattedRowValue,
  type ComparisonItem,
} from "@/lib/compare-data";
import { isDatabaseConfigured } from "@/lib/db/client";
import {
  getAllCameras,
  getAllLenses,
  getLensBySlug,
} from "@/lib/services/equipment";

export const alt = "Lens specifications";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  if (!isDatabaseConfigured()) {
    console.warn(
      "[opengraph-image] DATABASE_URL not set — skipping static generation for lens OG images.",
    );
    return [];
  }
  const lenses = await getAllLenses();
  return lenses.map((lens) => ({ slug: lens.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });

  const lens = await getLensBySlug(slug);

  if (!lens) {
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

  const item: ComparisonItem = { type: "lens", ...lens };
  const cameras = await getAllCameras();
  const rows = buildComparisonRows([item], cameras);
  const value = (rowId: string) => getFormattedRowValue(rows, rowId, 0, t);

  return new ImageResponse(
    <OgCard
      eyebrow={`${t("Common.siteName")} · ${t("CompareSelector.typeLens")}`}
      title={`${item.brand} ${item.model}`}
      subtitle={t("ProductPage.specsHeading")}
      specs={[
        { label: t("ComparePage.rows.mount"), value: value("mount") },
        {
          label: t("ComparePage.rows.focalLength"),
          value: value("focalLength"),
        },
        {
          label: t("ComparePage.rows.maxAperture"),
          value: value("maxAperture"),
        },
        {
          label: t("ComparePage.rows.equivalentFocalLength"),
          value: value("equivalentFocalLength"),
        },
      ]}
    />,
    { ...size },
  );
}
