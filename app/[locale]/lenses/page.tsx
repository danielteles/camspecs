import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LensesCatalog } from "@/components/lenses-catalog";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getAllLenses } from "@/lib/services/equipment";

// Matches the on-demand revalidation the scraper pipeline triggers via
// POST /api/revalidate after upserting rows; this is the fallback in case
// a revalidation call is missed.
export const revalidate = 3600;

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
}: PageProps<"/[locale]/lenses">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Catalog.lenses");
  // This route has no dynamic API usage, so Next.js statically prerenders
  // it at build time by default — a CI build with the DB secret unset
  // would otherwise hard-fail here the same way the [slug] pages' unguarded
  // generateStaticParams used to (see lib/db/client.ts). Rendering an empty
  // catalog degrades to the component's existing "no results" state instead.
  let lenses: Awaited<ReturnType<typeof getAllLenses>> = [];
  if (isDatabaseConfigured()) {
    lenses = await getAllLenses();
  } else {
    console.warn(
      "[lenses] DATABASE_URL not set — skipping catalog fetch; rendering empty catalog.",
    );
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-base">{t("description")}</p>
      </div>

      <LensesCatalog lenses={lenses} />
    </main>
  );
}
