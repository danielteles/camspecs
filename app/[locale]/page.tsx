import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { EquipmentCard } from "@/components/equipment-card";
import { Link } from "@/i18n/navigation";
import {
  formatAperture,
  formatFocalLengthRange,
  SENSOR_FORMAT_BADGE_VARIANT,
  SENSOR_FORMAT_KEYS,
} from "@/lib/compare-data";
import { CAMERAS, LENSES, MOUNTS } from "@/lib/mock-data";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("HomePage");
  const tGlobal = await getTranslations();

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
            {CAMERAS.map((camera) => (
              <EquipmentCard
                key={camera.slug}
                href={`/cameras/${camera.slug}`}
                eyebrow={MOUNTS[camera.mount].name}
                title={`${camera.brand} ${camera.model}`}
                meta={`${camera.megapixels} MP · ${camera.releaseYear}`}
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
            {LENSES.map((lens) => (
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
