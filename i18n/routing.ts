import { defineRouting } from "next-intl/routing";

export const locales = ["en", "pt-BR"] as const;

export const defaultLocale: (typeof locales)[number] = "en";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
