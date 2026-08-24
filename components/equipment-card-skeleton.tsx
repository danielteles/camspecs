import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors CatalogItemCard's layout so the grid doesn't reflow once real cards arrive. */
export function EquipmentCardSkeleton() {
  return (
    <div
      className="border-border flex flex-col gap-2 rounded-lg border p-4"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-14 shrink-0 rounded-4xl" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="mt-2 flex flex-col gap-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
    </div>
  );
}
