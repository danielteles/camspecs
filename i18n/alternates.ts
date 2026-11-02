import type { Metadata } from "next";

import { routing } from "./routing";

type Locale = (typeof routing.locales)[number];

/**
 * The same page in every locale, keyed by locale — e.g. "/cameras" →
 * { en: "/en/cameras", "pt-BR": "/pt-BR/cameras", es: "/es/cameras" }.
 * Pass `base` for absolute URLs (the sitemap); metadata resolves relative
 * paths against `metadataBase` itself.
 */
export function languageAlternates(
  path: string,
  base = "",
): Record<Locale, string> {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, `${base}/${locale}${path}`]),
  ) as Record<Locale, string>; // every key in routing.locales is mapped above
}

/** `alternates` metadata for `path` rendered in `locale`. */
export function localeAlternates(
  locale: string,
  path: string,
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: `/${locale}${path}`,
    languages: languageAlternates(path),
  };
}
