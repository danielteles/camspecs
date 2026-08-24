import { EquipmentCardSkeleton } from "@/components/equipment-card-skeleton";

interface CatalogGridSkeletonProps {
  /** Number of placeholder cards to render. */
  count?: number;
  /** Announced to screen readers while the grid is loading. */
  loadingLabel: string;
}

export function CatalogGridSkeleton({
  count = 6,
  loadingLabel,
}: CatalogGridSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{loadingLabel}</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, index) => (
          <EquipmentCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
