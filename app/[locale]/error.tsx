"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Catches render errors from any page under [locale] so a failure shows
// localized recovery UI inside the normal navbar/footer shell, rather than
// Next's default error screen. Errors in the root layout itself would need
// global-error.tsx instead.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("ErrorPage");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6 lg:px-8"
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground text-lg">{t("description")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" onClick={retry}>
          {t("retry")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t("homeLink")}</Link>
        </Button>
      </div>
    </main>
  );
}
