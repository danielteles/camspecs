"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

function getLanguageAutonym(locale: string): string {
  const name =
    new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  const [languageName] = name.split(" (");
  return languageName.charAt(0).toUpperCase() + languageName.slice(1);
}

function LocaleLinks({ queryString }: { queryString: string }) {
  const pathname = usePathname();
  const activeLocale = useLocale();
  const t = useTranslations("LanguageSwitcher");

  return (
    <nav aria-label={t("label")}>
      <ul className="flex items-center gap-1">
        {routing.locales.map((locale) => {
          const isActive = locale === activeLocale;
          const href = queryString
            ? {
                pathname,
                query: Object.fromEntries(new URLSearchParams(queryString)),
              }
            : { pathname };

          return (
            <li key={locale}>
              <Button
                asChild
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                aria-current={isActive ? "true" : undefined}
              >
                <Link href={href} locale={locale} hrefLang={locale}>
                  {getLanguageAutonym(locale)}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Reads the current query string so switching locales preserves state that
// lives in the URL (e.g. the /compare page's selected items). Isolated into
// its own component because `useSearchParams` requires a Suspense boundary
// to avoid opting static pages into client-side rendering.
function LocaleLinksWithSearchParams() {
  const searchParams = useSearchParams();
  return <LocaleLinks queryString={searchParams.toString()} />;
}

export function LanguageSwitcher() {
  return (
    <Suspense fallback={<LocaleLinks queryString="" />}>
      <LocaleLinksWithSearchParams />
    </Suspense>
  );
}
