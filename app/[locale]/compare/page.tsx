import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { CompareSelector } from "@/components/compare-selector";

export default async function ComparePage({
  params,
}: PageProps<"/[locale]/compare">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("ComparePage");

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-base">{t("description")}</p>
      </div>

      <Suspense>
        <CompareSelector />
      </Suspense>
    </main>
  );
}
