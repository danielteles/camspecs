"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

function getLanguageAutonym(locale: string): string {
  return (
    new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale
  );
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const activeLocale = useLocale();
  const t = useTranslations("LanguageSwitcher");

  return (
    <nav aria-label={t("label")}>
      <ul className="flex items-center gap-1">
        {routing.locales.map((locale) => {
          const isActive = locale === activeLocale;

          return (
            <li key={locale}>
              <Button
                asChild
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                aria-current={isActive ? "true" : undefined}
              >
                <Link href={pathname} locale={locale} hrefLang={locale}>
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
