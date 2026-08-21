"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DiffToggle({ children }: { children: React.ReactNode }) {
  const [diffOnly, setDiffOnly] = useState(false);
  const t = useTranslations("ComparePage");

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant={diffOnly ? "secondary" : "outline"}
        size="sm"
        aria-pressed={diffOnly}
        onClick={() => setDiffOnly((prev) => !prev)}
        className="self-start"
      >
        {t("diffToggleLabel")}
      </Button>
      <div data-diff={diffOnly || undefined}>{children}</div>
    </div>
  );
}
