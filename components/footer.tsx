import { ExternalLinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { resolveComparisonItems } from "@/lib/compare-data";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getAllCameras, getAllLenses } from "@/lib/services/equipment";

const GITHUB_URL = "https://github.com/danielteles/camspecs";

// Verified live against the current cameras table (see
// lib/services/equipment.ts's toCamera — a slug only resolves here if it
// also passes full frontend validation, not just "exists"). Sourced from
// our manufacturer/Versus-scraped cameras rather than Wikidata-only ones,
// since those are the records this pipeline reliably keeps populated on
// every run — a Wikidata-only pick could silently drop out of a future
// crawl's top-N-by-recency window. One pairing per curated mount pair.
const POPULAR_COMPARISON_SLUGS: [string, string][] = [
  ["sony-alpha-7-iv", "canon-eos-r6-mark-ii"],
  ["canon-eos-r8", "sony-alpha-6700"],
  ["nikon-zf", "fujifilm-x-t50"],
];

const FOOTER_LINK_CLASSNAME =
  "focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground w-fit rounded-md focus-visible:ring-3 focus-visible:outline-none hover:underline";

export async function Footer() {
  const t = await getTranslations("Footer");
  const tCommon = await getTranslations("Common");

  // The footer renders on every page, so this runs during static generation
  // for the whole site — a CI build with the DB secret unset would
  // otherwise hard-fail here the same way the catalog pages' unguarded
  // fetches used to (see lib/db/client.ts). Rendering no popular
  // comparisons degrades gracefully instead.
  let popularComparisons: { href: string; label: string }[] = [];
  if (isDatabaseConfigured()) {
    const [cameras, lenses] = await Promise.all([
      getAllCameras(),
      getAllLenses(),
    ]);
    popularComparisons = POPULAR_COMPARISON_SLUGS.map((slugs) => {
      const items = resolveComparisonItems(slugs, cameras, lenses);
      return {
        href: `/compare?items=${slugs.join(",")}`,
        label: items.map((item) => `${item.brand} ${item.model}`).join(" vs "),
      };
    }).filter((comparison) => comparison.label.includes(" vs "));
  } else {
    console.warn(
      "[footer] DATABASE_URL not set — skipping popular comparisons fetch.",
    );
  }

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
