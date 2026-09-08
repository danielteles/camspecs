import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { EquipmentCard } from "@/components/equipment-card";
import { Link } from "@/i18n/navigation";
import {
  formatAperture,
  formatCameraCardMeta,
  formatFocalLengthRange,
  SENSOR_FORMAT_BADGE_VARIANT,
  SENSOR_FORMAT_KEYS,
} from "@/lib/compare-data";
import { isDatabaseConfigured } from "@/lib/db/client";
import { MOUNTS } from "@/lib/mounts";
import { getAllCameras, getAllLenses } from "@/lib/services/equipment";

// Backstop for a missed on-demand revalidateTag call from the scraper
// pipeline (which runs roughly every two weeks) — see
// lib/services/equipment.ts's EQUIPMENT_CACHE_REVALIDATE_SECONDS.
export const revalidate = 1209600; // 14 days

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("HomePage");
  const tGlobal = await getTranslations();
  // This route has no dynamic API usage, so Next.js statically prerenders
  // it at build time by default — a CI build with the DB secret unset
  // would otherwise hard-fail here the same way the catalog pages'
  // unguarded fetches used to (see lib/db/client.ts).
  let cameras: Awaited<ReturnType<typeof getAllCameras>> = [];
  let lenses: Awaited<ReturnType<typeof getAllLenses>> = [];
  if (isDatabaseConfigured()) {
    [cameras, lenses] = await Promise.all([getAllCameras(), getAllLenses()]);
  } else {
    console.warn(
      "[home] DATABASE_URL not set — skipping featured equipment fetch.",
    );
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-foreground/80 text-lg">{t("tagline")}</p>
        <p className="text-muted-foreground max-w-2xl text-base">
          {t("description")}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/compare">{t("startComparingCta")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/cameras">{t("browseCamerasCta")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/lenses">{t("browseLensesCta")}</Link>
          </Button>
        </div>
      </div>

      <section
        aria-labelledby="featured-heading"
        className="flex flex-col gap-8"
      >
        <div className="flex flex-col gap-2">
          <h2
            id="featured-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            {t("featuredHeading")}
          </h2>
          <p className="text-muted-foreground text-base">
            {t("featuredDescription")}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold tracking-tight">
            {t("featuredCamerasHeading")}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cameras.map((camera) => (
              <EquipmentCard
                key={camera.slug}
                href={`/cameras/${camera.slug}`}
                eyebrow={MOUNTS[camera.mount].name}
                title={`${camera.brand} ${camera.model}`}
                meta={formatCameraCardMeta(camera)}
                badgeLabel={tGlobal(SENSOR_FORMAT_KEYS[camera.sensorFormat])}
                badgeVariant={SENSOR_FORMAT_BADGE_VARIANT[camera.sensorFormat]}
                cta={t("viewSpecsCta")}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold tracking-tight">
            {t("featuredLensesHeading")}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lenses.map((lens) => (
              <EquipmentCard
                key={lens.slug}
                href={`/lenses/${lens.slug}`}
                eyebrow={MOUNTS[lens.mount].name}
                title={`${lens.brand} ${lens.model}`}
                meta={`${formatFocalLengthRange(lens.minFocalLengthMm, lens.maxFocalLengthMm)} · ${formatAperture(lens.maxAperture)}`}
                cta={t("viewSpecsCta")}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
