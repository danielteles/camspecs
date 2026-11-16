"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useLayoutEffect } from "react";

import { buttonVariants } from "@/components/ui/button";
import { setTheme, useTheme } from "@/components/use-theme";
import { applyTheme, readStoredTheme } from "@/lib/theme";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", Icon: MonitorIcon },
  { value: "light", Icon: SunIcon },
  { value: "dark", Icon: MoonIcon },
] as const satisfies readonly { value: Theme; Icon: unknown }[];

export function ThemeSwitcher() {
  const t = useTranslations("Theme");
  const theme = useTheme();
  // The header and the mobile menu each render a switcher; a shared radio
  // name would merge them into one group.
  const name = useId();

  // In production the inline <head> script has already set the class. In
  // development, Strict Mode's remount resets <html> to its JSX attributes
  // and drops it, so put it back before paint.
  useLayoutEffect(() => {
    applyTheme(readStoredTheme());
  }, []);

  return (
    <fieldset>
      <legend className="sr-only">{t("label")}</legend>
      <div className="flex items-center gap-1">
        {OPTIONS.map(({ value, Icon }) => (
          <label
            key={value}
            title={t(value)}
            className={cn(
              buttonVariants({
                variant: theme === value ? "secondary" : "ghost",
                size: "icon",
              }),
              "has-focus-visible:ring-ring cursor-pointer has-focus-visible:ring-3",
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={theme === value}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon aria-hidden />
            <span className="sr-only">{t(value)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
