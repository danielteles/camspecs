import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface CatalogItemCardProps {
  href: string;
  compareHref: string;
  eyebrow: string;
  title: string;
  meta: string;
  badgeLabel?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  viewSpecsLabel: string;
  addToCompareLabel: string;
}

export function CatalogItemCard({
  href,
  compareHref,
  eyebrow,
  title,
  meta,
  badgeLabel,
  badgeVariant = "outline",
  viewSpecsLabel,
  addToCompareLabel,
}: CatalogItemCardProps) {
  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{eyebrow}</p>
        {badgeLabel && <Badge variant={badgeVariant}>{badgeLabel}</Badge>}
      </div>
      <h3 className="text-base font-semibold tracking-tight">
        <Link
          href={href}
          className="focus-visible:ring-ring/50 rounded-md hover:underline focus-visible:ring-3 focus-visible:outline-none"
        >
          {title}
        </Link>
      </h3>
      <p className="text-muted-foreground text-sm">{meta}</p>
      <div className="mt-2 flex gap-2">
        <Button asChild size="sm" variant="outline" className="flex-1">
          <Link href={href}>{viewSpecsLabel}</Link>
        </Button>
        <Button asChild size="sm" className="flex-1">
          <Link href={compareHref}>{addToCompareLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
