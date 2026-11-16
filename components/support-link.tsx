import { CoffeeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface SupportLinkProps {
  href: string;
  className?: string;
}

// Synchronous (useTranslations, not getTranslations) so it can be nested
// inside other server components — Footer included — and still render in
// component tests, which can't resolve a nested async component.
export function SupportLink({ href, className }: SupportLinkProps) {
  const t = useTranslations("Support");
  const tCommon = useTranslations("Common");

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1", className)}
    >
      <CoffeeIcon className="size-3.5 shrink-0" aria-hidden />
      {t("linkLabel")}{" "}
      <span className="sr-only">{tCommon("opensInNewTab")}</span>
    </a>
  );
}
