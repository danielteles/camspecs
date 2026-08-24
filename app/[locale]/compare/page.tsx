import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { CompareActions } from "@/components/compare-actions";
import { CompareSelector } from "@/components/compare-selector";
import { CompareTableOverlay } from "@/components/compare-table-overlay";
import { CompareTransitionProvider } from "@/components/compare-transition-provider";
import { DiffToggle } from "@/components/diff-toggle";
import { LastUpdatedBadge } from "@/components/last-updated-badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import {
  buildComparisonRows,
  formatRowValue,
  resolveComparisonItems,
  type ComparisonRow,
} from "@/lib/compare-data";
import { COMPARE_ITEMS_PARAM, parseCompareItems } from "@/lib/compare-params";
import { getAllCameras, getAllLenses } from "@/lib/services/equipment";

export default async function ComparePage({
  params,
  searchParams,
}: PageProps<"/[locale]/compare">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("ComparePage");
  const tGlobal = await getTranslations();

  const resolvedSearchParams = await searchParams;
  const itemsParam = resolvedSearchParams[COMPARE_ITEMS_PARAM];
  const slugs = parseCompareItems(
    Array.isArray(itemsParam) ? itemsParam[0] : itemsParam,
  );
  const [cameras, lenses] = await Promise.all([
    getAllCameras(),
    getAllLenses(),
  ]);
  const items = resolveComparisonItems(slugs, cameras, lenses);
  const rows: ComparisonRow[] = buildComparisonRows(items, cameras);
  // The oldest sync time among the compared items is the honest "data as
  // of" bound for the whole table — some items may have synced more
  // recently, none synced earlier than this.
  const oldestUpdatedAt = items.reduce<Date | null>(
    (oldest, item) =>
      !oldest || item.updatedAt < oldest ? item.updatedAt : oldest,
    null,
  );

  const comparisonContent = (
    <>
      {/* Desktop/tablet: a real table, one column per item. */}
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableCaption className="sr-only">{t("title")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                <span className="sr-only">{t("rows.type")}</span>
              </TableHead>
              {items.map((item) => (
                <TableHead key={item.slug} scope="col">
                  <Link
                    href={`/${item.type === "camera" ? "cameras" : "lenses"}/${item.slug}`}
                    className="focus-visible:ring-ring/50 rounded-md hover:underline focus-visible:ring-3 focus-visible:outline-none"
                  >
                    {item.brand} {item.model}
                  </Link>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                data-identical={row.isIdentical || undefined}
              >
                <TableHead scope="row" className="font-medium">
                  {tGlobal(row.labelKey)}
                </TableHead>
                {row.values.map((value, index) => (
                  <TableCell key={items[index]?.slug}>
                    {formatRowValue(value, tGlobal)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: one card per item, specs listed as a description list. */}
      <div className="flex flex-col gap-6 sm:hidden">
        {items.map((item, itemIndex) => (
          <section
            key={item.slug}
            aria-labelledby={`compare-card-${item.slug}`}
            className="border-border rounded-lg border p-4"
          >
            <h3 className="text-base font-semibold">
              <Link
                id={`compare-card-${item.slug}`}
                href={`/${item.type === "camera" ? "cameras" : "lenses"}/${item.slug}`}
                className="focus-visible:ring-ring/50 rounded-md hover:underline focus-visible:ring-3 focus-visible:outline-none"
              >
                {item.brand} {item.model}
              </Link>
            </h3>
            <dl className="divide-border mt-3 divide-y">
              {rows.map((row) => (
                <div
                  key={row.id}
                  data-identical={row.isIdentical || undefined}
                  className="flex items-baseline justify-between gap-4 py-2 text-sm"
                >
                  <dt className="text-muted-foreground">
                    {tGlobal(row.labelKey)}
                  </dt>
                  <dd className="text-right font-medium">
                    {formatRowValue(row.values[itemIndex] ?? null, tGlobal)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-base">{t("description")}</p>
      </div>

      <CompareTransitionProvider>
        <Suspense>
          <CompareSelector />
        </Suspense>

        <Suspense>
          <CompareActions />
        </Suspense>

        <CompareTableOverlay>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-base">{t("emptyState")}</p>
          ) : (
            <>
              {items.length === 1 && (
                <p className="text-muted-foreground text-base">
                  {t("addAnotherState")}
                </p>
              )}
              {items.length >= 2 ? (
                <DiffToggle>{comparisonContent}</DiffToggle>
              ) : (
                comparisonContent
              )}
              {oldestUpdatedAt && (
                <LastUpdatedBadge
                  date={oldestUpdatedAt}
                  variant="aggregate"
                  className="self-end"
                />
              )}
            </>
          )}
        </CompareTableOverlay>
      </CompareTransitionProvider>
    </main>
  );
}
