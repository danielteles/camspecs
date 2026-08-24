"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useCompareTransition } from "@/components/compare-transition-provider";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Blurs and dims the comparison results while a selector/swap change is applying. */
export function CompareTableOverlay({ children }: { children: ReactNode }) {
  const t = useTranslations("ComparePage");
  const { isPending } = useCompareTransition();

  return (
    <div className="relative">
      <div
        className={cn(
          "flex flex-col gap-6 transition-[opacity,filter] duration-150",
          isPending && "pointer-events-none opacity-50 blur-[1px]",
        )}
        aria-busy={isPending}
        aria-live="polite"
      >
        {children}
      </div>
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="text-muted-foreground size-6" />
          <span className="sr-only">{t("updatingLabel")}</span>
        </div>
      )}
    </div>
  );
}
