import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { FieldOfViewVisualizer } from "@/components/field-of-view-visualizer";
import { LastUpdatedBadge } from "@/components/last-updated-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  buildComparisonRows,
  formatRowValue,
  type ComparisonItem,
  type ComparisonRow,
} from "@/lib/compare-data";
import { MOUNTS } from "@/lib/mounts";
import {
  getAllCameras,
  getAllLenses,
  getLensBySlug,
} from "@/lib/services/equipment";

const SPEC_ROW_IDS = [
  "brand",
  "model",
  "mount",
  "releaseYear",
  "focalLength",
  "maxAperture",
  "cropFactor",
  "equivalentFocalLength",
  "equivalentAperture",
  "diagonalFieldOfView",
];

export async function generateStaticParams() {
  const lenses = await getAllLenses();
  return lenses.map((lens) => ({ slug: lens.slug }));
}

// Fallback for the case an on-demand revalidatePath call (triggered by the
// scraper pipeline after an upsert, see app/api/revalidate) is missed.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lenses/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const lens = await getLensBySlug(slug);
  if (!lens) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: "ProductPage" });
  const title = `${lens.brand} ${lens.model}`;
  const description = t("lensMetaDescription", {
    brand: lens.brand,
    model: lens.model,
  });

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/lenses/${slug}`,
      languages: { en: `/en/lenses/${slug}`, "pt-BR": `/pt-BR/lenses/${slug}` },
    },
    openGraph: { title, description },
  };
}

export default async function LensPage({
  params,
}: PageProps<"/[locale]/lenses/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const lens = await getLensBySlug(slug);
  if (!lens) {
    notFound();
  }
  const item: ComparisonItem = { type: "lens", ...lens };

  const cameras = await getAllCameras();
  const rows = buildComparisonRows([item], cameras);
  const specRows = SPEC_ROW_IDS.map((id) =>
    rows.find((row) => row.id === id),
  ).filter((row): row is ComparisonRow => row !== undefined);

  const t = await getTranslations();
  const tCommon = await getTranslations("Common");
  const tProduct = await getTranslations("ProductPage");
  const compatibleCameras = cameras.filter(
    (camera) => camera.mount === item.mount,
  );

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8"
    >
      <Breadcrumb
        label={tCommon("breadcrumbLabel")}
        items={[
          { label: tCommon("homeLink"), href: "/" },
          { label: tCommon("lensesLink"), href: "/lenses" },
          { label: `${item.brand} ${item.model}` },
        ]}
      />

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          {MOUNTS[item.mount].name}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {item.brand} {item.model}
        </h1>
        <Button asChild className="mt-2 self-start">
          <Link href={`/compare?items=${item.slug}`}>
            {tProduct("compareCta")}
          </Link>
        </Button>
      </div>

      <section
        aria-labelledby="lens-specs-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="lens-specs-heading"
          className="text-xl font-semibold tracking-tight"
        >
          {tProduct("specsHeading")}
        </h2>
        <dl className="divide-border border-border divide-y rounded-lg border">
          {specRows.map((row) => (
            <div
              key={row.id}
              className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm"
            >
              <dt className="text-muted-foreground">{t(row.labelKey)}</dt>
              <dd className="text-right font-medium">
                {formatRowValue(row.values[0] ?? null, t)}
              </dd>
            </div>
          ))}
        </dl>
        <LastUpdatedBadge date={item.updatedAt} className="self-end" />
      </section>

      {compatibleCameras[0] && (
        <section
          aria-labelledby="fov-heading"
          className="flex flex-col items-center gap-4"
        >
          <h2
            id="fov-heading"
            className="self-start text-xl font-semibold tracking-tight"
          >
            {tProduct("fovHeading")}
          </h2>
          <FieldOfViewVisualizer
            minFocalLengthMm={item.minFocalLengthMm}
            maxFocalLengthMm={item.maxFocalLengthMm}
            sensor={compatibleCameras[0].sensor}
          />
        </section>
      )}

      <section
        aria-labelledby="compatible-cameras-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="compatible-cameras-heading"
          className="text-xl font-semibold tracking-tight"
        >
          {tProduct("compatibleCamerasHeading")}
        </h2>
        {compatibleCameras.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tProduct("noCompatibleCameras")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {compatibleCameras.map((camera) => (
              <li key={camera.slug}>
                <Link
                  href={`/cameras/${camera.slug}`}
                  className="focus-visible:ring-ring/50 rounded-md text-sm font-medium hover:underline focus-visible:ring-3 focus-visible:outline-none"
                >
                  {camera.brand} {camera.model}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
