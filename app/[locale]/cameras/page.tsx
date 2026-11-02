import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CamerasCatalog } from "@/components/cameras-catalog";
import {
  parseCameraFilters,
  searchParamsFromRecord,
} from "@/lib/catalog-params";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getAllCameras, getFilteredCameras } from "@/lib/services/equipment";
import type { Camera } from "@/lib/types";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cameras">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Catalog.cameras" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/cameras`,
      languages: {
        en: "/en/cameras",
        "pt-BR": "/pt-BR/cameras",
        es: "/es/cameras",
      },
    },
  };
}

export default async function CamerasPage({
  params,
  searchParams,
}: PageProps<"/[locale]/cameras">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Catalog.cameras");
  const filters = parseCameraFilters(
    searchParamsFromRecord(await searchParams),
  );

  // Filters are read from the URL and applied via a real SQL WHERE clause
  // (see lib/services/equipment.ts's buildCamerasQuery) — this route is
  // inherently dynamic (per-request) once it depends on searchParams, so
  // there's no static catalog to fall back to when DATABASE_URL is unset
  // at build time the way the old unfiltered version needed to guard for.
  let cameras: Camera[] = [];
  let allCameras: Camera[] = [];
  if (isDatabaseConfigured()) {
    [cameras, allCameras] = await Promise.all([
      getFilteredCameras(filters),
      getAllCameras(),
    ]);
  } else {
    console.warn(
      "[cameras] DATABASE_URL not set — skipping catalog fetch; rendering empty catalog.",
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

      <CamerasCatalog cameras={cameras} allCameras={allCameras} />
    </main>
  );
}
