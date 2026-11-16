import { ExternalLinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { RetailerLink } from "@/lib/affiliate";

interface WhereToBuyProps {
  links: readonly RetailerLink[];
}

export async function WhereToBuy({ links }: WhereToBuyProps) {
  if (links.length === 0) {
    return null;
  }

  const t = await getTranslations("WhereToBuy");
  const tCommon = await getTranslations("Common");

  return (
    <section
      aria-labelledby="where-to-buy-heading"
      className="flex flex-col gap-4"
    >
      <h2
        id="where-to-buy-heading"
        className="text-xl font-semibold tracking-tight"
      >
        {t("heading")}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.retailerId}>
            <a
              href={link.href}
              target="_blank"
              // "sponsored" is Google's required marker for paid links.
              rel="sponsored nofollow noopener noreferrer"
              className="border-border hover:bg-muted focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:ring-3 focus-visible:outline-none"
            >
              {t("checkPriceAt", { retailer: link.name })}
              <ExternalLinkIcon
                className="size-3.5 shrink-0"
                aria-hidden
              />{" "}
              <span className="sr-only">{tCommon("opensInNewTab")}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">{t("disclosure")}</p>
    </section>
  );
}
