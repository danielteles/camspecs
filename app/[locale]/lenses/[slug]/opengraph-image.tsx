import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { OgCard } from "@/components/og-card";
import {
  buildComparisonRows,
  getFormattedRowValue,
  resolveComparisonItems,
} from "@/lib/compare-data";
import { LENSES } from "@/lib/mock-data";

export const alt = "Lens specifications";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return LENSES.map((lens) => ({ slug: lens.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });

  const [item] = resolveComparisonItems([slug]);

  if (!item || item.type !== "lens") {
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

  const rows = buildComparisonRows([item]);
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
