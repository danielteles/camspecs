import type { Metadata } from "next";
import { createTranslator } from "next-intl";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { cookies, headers } from "next/headers";

import { Button } from "@/components/ui/button";
import { routing } from "@/i18n/routing";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// This page bypasses the [locale] route tree entirely (it's what Next.js
// renders for URLs that don't match any route at all), so there's no
// `params.locale` and no NextIntlClientProvider to read from. Resolve a
// locale by hand from the cookie next-intl's middleware sets, falling back
// to the Accept-Language header and then the default locale.
async function resolveLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (
    cookieLocale &&
    routing.locales.includes(cookieLocale as (typeof routing.locales)[number])
  ) {
    return cookieLocale as (typeof routing.locales)[number];
  }

  const headerList = await headers();
  const preferred = headerList
    .get("accept-language")
    ?.split(",")[0]
    ?.split("-")[0]
    ?.toLowerCase();
  const matched = routing.locales.find((locale) =>
    locale.toLowerCase().startsWith(preferred ?? ""),
  );

  return matched ?? routing.defaultLocale;
}

export const metadata: Metadata = {
  title: "404",
  robots: { index: false },
};

export default async function GlobalNotFound() {
  const locale = await resolveLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "NotFound" });

  return (
    <html
      lang={locale}
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <main
          id="main-content"
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6 lg:px-8"
        >
          <p className="text-muted-foreground text-sm font-medium">
            {t("eyebrow")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-lg">{t("description")}</p>
          <Button asChild className="mt-2 self-start">
            <Link href={`/${locale}`}>{t("backHome")}</Link>
          </Button>
        </main>
      </body>
    </html>
  );
}
