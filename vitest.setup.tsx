import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, vi } from "vitest";

import { createTranslator } from "@/test/mocks/i18n";
import {
  mockUsePathname,
  mockUseRouter,
  mockUseSearchParams,
  resetNavigationMocks,
} from "@/test/mocks/navigation";

// jsdom doesn't implement these; radix-ui (Dialog/Popover) and cmdk read
// them during open/close and keyboard-navigation interactions, and throw
// if they're missing.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof window.matchMedia === "undefined") {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}

// next-intl client hooks: resolve real strings from messages/en.json so
// assertions can check actual UI copy instead of raw i18n keys.
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "en",
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => children,
}));

// next-intl/server: same translator, wrapped as the async API server
// components use.
vi.mock("next-intl/server", () => ({
  getTranslations: async (
    options?: string | { namespace?: string; locale?: string },
  ) => {
    const namespace =
      typeof options === "string" ? options : options?.namespace;
    return createTranslator(namespace);
  },
  setRequestLocale: vi.fn(),
}));

// The app's locale-aware router wrapper (@/i18n/navigation). Link becomes a
// plain <a>; usePathname/useRouter delegate to configurable mocks so each
// test can control the "current route" and assert on navigation calls.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: ReactNode;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    [key: string]: unknown;
  }) => {
    const resolvedHref =
      typeof href === "string" ? href : (href?.pathname ?? "#");
    return (
      <a
        href={resolvedHref}
        onClick={(event) => {
          // jsdom doesn't implement real navigation; suppress its "not
          // implemented" console noise while still calling the app's
          // own onClick (e.g. Navbar closing the mobile drawer).
          event.preventDefault();
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
  usePathname: () => mockUsePathname(),
  useRouter: () => mockUseRouter(),
  redirect: vi.fn(),
  getPathname: vi.fn(),
}));

// Plain next/navigation: only the pieces components import directly
// (useSearchParams in compare-selector.tsx, compare-actions.tsx,
// language-switcher.tsx).
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => mockUsePathname(),
  useRouter: () => mockUseRouter(),
}));

beforeEach(() => {
  resetNavigationMocks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
