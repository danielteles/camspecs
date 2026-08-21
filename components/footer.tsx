import { ExternalLinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { resolveComparisonItems } from "@/lib/compare-data";

const GITHUB_URL = "https://github.com/danielteles/camspecs";

const POPULAR_COMPARISON_SLUGS: [string, string][] = [
  ["sony-a7-iv", "fujifilm-x-t5"],
  ["fujifilm-x-t5", "om-system-om-1"],
  ["sony-fe-50mm-f1-8", "fujifilm-xf-16-55mm-f2-8"],
];

const FOOTER_LINK_CLASSNAME =
  "focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground w-fit rounded-md focus-visible:ring-3 focus-visible:outline-none hover:underline";

export async function Footer() {
  const t = await getTranslations("Footer");
  const tCommon = await getTranslations("Common");

  const popularComparisons = POPULAR_COMPARISON_SLUGS.map((slugs) => {
    const items = resolveComparisonItems(slugs);
    return {
      href: `/compare?items=${slugs.join(",")}`,
      label: items.map((item) => `${item.brand} ${item.model}`).join(" vs "),
    };
  }).filter((comparison) => comparison.label.includes(" vs "));

  return (
    <footer className="border-border border-t">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("catalogsHeading")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/cameras" className={FOOTER_LINK_CLASSNAME}>
                {tCommon("camerasLink")}
              </Link>
            </li>
            <li>
              <Link href="/lenses" className={FOOTER_LINK_CLASSNAME}>
                {tCommon("lensesLink")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("popularComparisonsHeading")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {popularComparisons.map((comparison) => (
              <li key={comparison.href}>
                <Link href={comparison.href} className={FOOTER_LINK_CLASSNAME}>
                  {comparison.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("moreHeading")}
          </h2>
          <LanguageSwitcher />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${FOOTER_LINK_CLASSNAME} inline-flex items-center gap-1`}
          >
            {t("githubLink")}
            <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
          </a>
        </div>
      </div>
    </footer>
  );
}
