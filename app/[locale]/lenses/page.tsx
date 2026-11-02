import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LensesCatalog } from "@/components/lenses-catalog";
import { parseLensFilters, searchParamsFromRecord } from "@/lib/catalog-params";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getAllLenses, getFilteredLenses } from "@/lib/services/equipment";
import type { Lens } from "@/lib/types";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lenses">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Catalog.lenses" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/lenses`,
      languages: {
        en: "/en/lenses",
        "pt-BR": "/pt-BR/lenses",
        es: "/es/lenses",
      },
    },
  };
}

export default async function LensesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/lenses">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Catalog.lenses");
  const filters = parseLensFilters(searchParamsFromRecord(await searchParams));

  // Filters are read from the URL and applied via a real SQL WHERE clause
  // (see lib/services/equipment.ts's buildLensesQuery) — this route is
  // inherently dynamic (per-request) once it depends on searchParams, so
  // there's no static catalog to fall back to when DATABASE_URL is unset
  // at build time the way the old unfiltered version needed to guard for.
  let lenses: Lens[] = [];
  let allLenses: Lens[] = [];
  if (isDatabaseConfigured()) {
    [lenses, allLenses] = await Promise.all([
      getFilteredLenses(filters),
      getAllLenses(),
    ]);
  } else {
    console.warn(
      "[lenses] DATABASE_URL not set — skipping catalog fetch; rendering empty catalog.",
    );
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-base">{t("description")}</p>
      </div>

      <LensesCatalog lenses={lenses} allLenses={allLenses} />
    </main>
  );
}
