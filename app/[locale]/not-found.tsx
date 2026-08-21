import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
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
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </main>
  );
}
