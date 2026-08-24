import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { LastUpdatedBadge } from "@/components/last-updated-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  buildComparisonRows,
  formatRowValue,
  type ComparisonItem,
  type ComparisonRow,
} from "@/lib/compare-data";
import { isDatabaseConfigured } from "@/lib/db/client";
import { MOUNTS } from "@/lib/mounts";
import {
  getAllCameras,
  getAllLenses,
  getCameraBySlug,
} from "@/lib/services/equipment";

const SPEC_ROW_IDS = [
  "brand",
  "model",
  "mount",
  "releaseYear",
  "sensorFormat",
  "sensorSize",
  "cropFactor",
  "megapixels",
];

export async function generateStaticParams() {
  if (!isDatabaseConfigured()) {
    console.warn(
      "[cameras/[slug]] DATABASE_URL not set — skipping static generation; pages will render on demand.",
    );
    return [];
  }
  const cameras = await getAllCameras();
  return cameras.map((camera) => ({ slug: camera.slug }));
}

// Fallback for the case an on-demand revalidatePath call (triggered by the
// scraper pipeline after an upsert, see app/api/revalidate) is missed.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cameras/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const camera = await getCameraBySlug(slug);
  if (!camera) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: "ProductPage" });
  const title = `${camera.brand} ${camera.model}`;
  const description = t("cameraMetaDescription", {
    brand: camera.brand,
    model: camera.model,
  });

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/cameras/${slug}`,
      languages: {
        en: `/en/cameras/${slug}`,
        "pt-BR": `/pt-BR/cameras/${slug}`,
        es: `/es/cameras/${slug}`,
      },
    },
    openGraph: { title, description },
  };
}

export default async function CameraPage({
  params,
}: PageProps<"/[locale]/cameras/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const camera = await getCameraBySlug(slug);
  if (!camera) {
    notFound();
  }
  const item: ComparisonItem = { type: "camera", ...camera };

  const rows = buildComparisonRows([item]);
  const specRows = SPEC_ROW_IDS.map((id) =>
    rows.find((row) => row.id === id),
  ).filter((row): row is ComparisonRow => row !== undefined);

  const t = await getTranslations();
  const tCommon = await getTranslations("Common");
  const tProduct = await getTranslations("ProductPage");
  const lenses = await getAllLenses();
  const compatibleLenses = lenses.filter((lens) => lens.mount === item.mount);

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8"
    >
      <Breadcrumb
        label={tCommon("breadcrumbLabel")}
        items={[
          { label: tCommon("homeLink"), href: "/" },
          { label: tCommon("camerasLink"), href: "/cameras" },
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
        aria-labelledby="camera-specs-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="camera-specs-heading"
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

      <section
        aria-labelledby="compatible-lenses-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="compatible-lenses-heading"
          className="text-xl font-semibold tracking-tight"
        >
          {tProduct("compatibleLensesHeading")}
        </h2>
        {compatibleLenses.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tProduct("noCompatibleLenses")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {compatibleLenses.map((lens) => (
              <li key={lens.slug}>
                <Link
                  href={`/lenses/${lens.slug}`}
                  className="focus-visible:ring-ring/50 rounded-md text-sm font-medium hover:underline focus-visible:ring-3 focus-visible:outline-none"
                >
                  {lens.brand} {lens.model}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
