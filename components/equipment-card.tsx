import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface EquipmentCardProps {
  href: string;
  eyebrow: string;
  title: string;
  meta: string;
  badgeLabel?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  cta: string;
  className?: string;
}

export function EquipmentCard({
  href,
  eyebrow,
  title,
  meta,
  badgeLabel,
  badgeVariant = "outline",
  cta,
  className,
}: EquipmentCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "border-border focus-visible:ring-ring/50 hover:bg-muted group flex flex-col gap-2 rounded-lg border p-4 transition-colors focus-visible:ring-3 focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{eyebrow}</p>
        {badgeLabel && <Badge variant={badgeVariant}>{badgeLabel}</Badge>}
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-sm">{meta}</p>
      <span className="text-primary mt-1 inline-flex items-center gap-1 text-sm font-medium group-hover:underline">
        {cta}
        <span aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}
