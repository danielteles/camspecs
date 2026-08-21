import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("HomePage");

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6 lg:px-8"
    >
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <p className="text-lg text-neutral-700 dark:text-neutral-300">
        {t("tagline")}
      </p>
      <p className="text-base text-neutral-600 dark:text-neutral-400">
        {t("description")}
      </p>
    </main>
  );
}
