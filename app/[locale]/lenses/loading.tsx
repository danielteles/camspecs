import { getTranslations } from "next-intl/server";

import { CatalogGridSkeleton } from "@/components/catalog-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default async function LensesLoading() {
  const t = await getTranslations("Catalog.lenses");

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>

      <div className="flex flex-col gap-6">
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          aria-hidden="true"
        >
          <Skeleton className="h-8 w-full sm:w-80" />
          <Skeleton className="h-7 w-24 md:hidden" />
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          <aside
            className="hidden shrink-0 flex-col gap-4 md:flex md:w-56"
            aria-hidden="true"
          >
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-16 w-full" />
          </aside>

          <div className="min-w-0 flex-1">
            <CatalogGridSkeleton loadingLabel={t("loadingLabel")} />
          </div>
        </div>
      </div>
    </main>
  );
}
