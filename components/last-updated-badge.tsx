import { RefreshCwIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LastUpdatedBadgeProps {
  /** When the ETL scraper pipeline last synced this record's specs. */
  date: Date;
  /**
   * Use "aggregate" when `date` summarizes several items (e.g. the oldest
   * sync time across a comparison) rather than a single record's own
   * timestamp, so the copy doesn't imply every item shares that exact date.
   */
  variant?: "single" | "aggregate";
  className?: string;
}

export async function LastUpdatedBadge({
  date,
  variant = "single",
  className,
}: LastUpdatedBadgeProps) {
  const t = await getTranslations("LastUpdated");
  const format = await getFormatter();
  const formattedDate = format.dateTime(date, { dateStyle: "medium" });

  return (
    <Badge
      variant="outline"
      className={cn("text-muted-foreground font-normal", className)}
    >
      <RefreshCwIcon data-icon="inline-start" aria-hidden className="size-3" />
      {t(variant === "aggregate" ? "aggregateLabel" : "label", {
        date: formattedDate,
      })}
    </Badge>
  );
}
