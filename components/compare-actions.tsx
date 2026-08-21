"use client";

import { ArrowLeftRightIcon, CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  COMPARE_ITEMS_PARAM,
  parseCompareItems,
  serializeCompareItems,
} from "@/lib/compare-params";

const COPY_FEEDBACK_MS = 2000;

export function CompareActions() {
  const t = useTranslations("ComparePage");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);

  const slugs = parseCompareItems(searchParams.get(COMPARE_ITEMS_PARAM));

  if (slugs.length === 0) {
    return null;
  }

  function handleSwap() {
    const [first, second, ...rest] = slugs;
    if (!first || !second) {
      return;
    }

    router.replace(
      {
        pathname,
        query: {
          [COMPARE_ITEMS_PARAM]: serializeCompareItems([
            second,
            first,
            ...rest,
          ]),
        },
      },
      { scroll: false },
    );
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {slugs.length === 2 && (
        <Button type="button" variant="outline" size="sm" onClick={handleSwap}>
          <ArrowLeftRightIcon aria-hidden />
          {t("swapItemsCta")}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        {copied ? t("copiedLabel") : t("copyLinkCta")}
      </Button>
    </div>
  );
}
