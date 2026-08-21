import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LensesCatalog } from "@/components/lenses-catalog";
import { LENSES } from "@/lib/mock-data";

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
      languages: { en: "/en/lenses", "pt-BR": "/pt-BR/lenses" },
    },
  };
}

export default async function LensesPage({
  params,
}: PageProps<"/[locale]/lenses">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Catalog.lenses");

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

      <LensesCatalog lenses={LENSES} />
    </main>
  );
}
