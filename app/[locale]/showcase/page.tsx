import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isDatabaseConfigured } from "@/lib/db/client";
import { MOUNTS } from "@/lib/mounts";
import { getAllCameras } from "@/lib/services/equipment";

export const revalidate = 3600;

export default async function ShowcasePage({
  params,
}: PageProps<"/[locale]/showcase">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Showcase");
  // This route has no dynamic API usage, so Next.js statically prerenders
  // it at build time by default — a CI build with the DB secret unset
  // would otherwise hard-fail here the same way the catalog pages'
  // unguarded fetches used to (see lib/db/client.ts).
  let cameras: Awaited<ReturnType<typeof getAllCameras>> = [];
  if (isDatabaseConfigured()) {
    cameras = await getAllCameras();
  } else {
    console.warn("[showcase] DATABASE_URL not set — skipping camera fetch.");
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-base">{t("description")}</p>
      </div>

      <section
        aria-labelledby="showcase-buttons"
        className="flex flex-col gap-4"
      >
        <h2
          id="showcase-buttons"
          className="text-xl font-semibold tracking-tight"
        >
          {t("buttons.heading")}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t("buttons.default")}</Button>
          <Button variant="outline">{t("buttons.outline")}</Button>
          <Button variant="secondary">{t("buttons.secondary")}</Button>
          <Button variant="ghost">{t("buttons.ghost")}</Button>
          <Button variant="destructive">{t("buttons.destructive")}</Button>
          <Button variant="link">{t("buttons.link")}</Button>
          <Button disabled>{t("buttons.disabled")}</Button>
        </div>
      </section>

      <section
        aria-labelledby="showcase-inputs"
        className="flex flex-col gap-4"
      >
        <h2
          id="showcase-inputs"
          className="text-xl font-semibold tracking-tight"
        >
          {t("inputs.heading")}
        </h2>
        <div className="grid max-w-sm gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="showcase-email" className="text-sm font-medium">
              {t("inputs.emailLabel")}
            </label>
            <Input
              id="showcase-email"
              type="email"
              placeholder={t("inputs.emailPlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="showcase-disabled" className="text-sm font-medium">
              {t("inputs.disabledLabel")}
            </label>
            <Input id="showcase-disabled" disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="showcase-invalid" className="text-sm font-medium">
              {t("inputs.invalidLabel")}
            </label>
            <Input
              id="showcase-invalid"
              defaultValue="not-a-real-slug"
              aria-invalid="true"
              aria-describedby="showcase-invalid-error"
            />
            <p id="showcase-invalid-error" className="text-destructive text-sm">
              {t("inputs.invalidError")}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="showcase-badges"
        className="flex flex-col gap-4"
      >
        <h2
          id="showcase-badges"
          className="text-xl font-semibold tracking-tight"
        >
          {t("badges.heading")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t("badges.default")}</Badge>
          <Badge variant="secondary">{t("badges.secondary")}</Badge>
          <Badge variant="outline">{t("badges.outline")}</Badge>
          <Badge variant="destructive">{t("badges.destructive")}</Badge>
        </div>
      </section>

      <section aria-labelledby="showcase-table" className="flex flex-col gap-4">
        <h2
          id="showcase-table"
          className="text-xl font-semibold tracking-tight"
        >
          {t("table.heading")}
        </h2>
        <Table>
          <TableCaption>{t("table.caption")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("table.model")}</TableHead>
              <TableHead scope="col">{t("table.brand")}</TableHead>
              <TableHead scope="col">{t("table.mount")}</TableHead>
              <TableHead scope="col">{t("table.sensorFormat")}</TableHead>
              <TableHead scope="col" className="text-right">
                {t("table.megapixels")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cameras.map((camera) => (
              <TableRow key={camera.slug}>
                <TableHead scope="row" className="font-medium">
                  {camera.model}
                </TableHead>
                <TableCell>{camera.brand}</TableCell>
                <TableCell>{MOUNTS[camera.mount].name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{camera.sensorFormat}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {camera.megapixels}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
