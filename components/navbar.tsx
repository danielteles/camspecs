"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", labelKey: "homeLink" },
  { href: "/compare", labelKey: "compareLink" },
  { href: "/cameras", labelKey: "camerasLink" },
  { href: "/lenses", labelKey: "lensesLink" },
] as const;

function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  children,
  onNavigate,
  className,
}: {
  href: string;
  children: ReactNode;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 rounded-md text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const t = useTranslations("Common");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="focus-visible:ring-ring/50 rounded-md text-base font-semibold tracking-tight focus-visible:ring-3 focus-visible:outline-none"
          >
            {t("siteName")}
          </Link>
          <nav
            aria-label={t("primaryNavLabel")}
            className="hidden items-center gap-6 md:flex"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("openMenu")}
              >
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              closeLabel={t("closeMenu")}
              className="w-4/5 sm:max-w-xs"
            >
              <SheetHeader>
                <SheetTitle>{t("siteName")}</SheetTitle>
              </SheetHeader>
              <nav
                aria-label={t("primaryNavLabel")}
                className="flex flex-col gap-1"
              >
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    onNavigate={() => setMobileOpen(false)}
                    className="hover:bg-muted rounded-md px-2 py-2"
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </nav>
              <div className="border-border mt-auto border-t pt-4">
                <LanguageSwitcher />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
