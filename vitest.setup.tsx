import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, vi } from "vitest";

import { createTranslator } from "@/test/mocks/i18n";
import { CAMERAS, LENSES } from "@/test/mocks/equipment";
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
// Stateful, so hasPointerCapture reflects real capture/release calls instead
// of always returning false — radix-ui's Slider gates pointermove/pointerup
// handling on hasPointerCapture, so a dumb false-returning stub would make
// every simulated drag in tests silently no-op.
if (!Element.prototype.setPointerCapture) {
  const capturedPointerIds = new WeakMap<Element, Set<number>>();
  Element.prototype.hasPointerCapture = function (pointerId: number) {
    return capturedPointerIds.get(this)?.has(pointerId) ?? false;
  };
  Element.prototype.setPointerCapture = function (pointerId: number) {
    if (!capturedPointerIds.has(this)) {
      capturedPointerIds.set(this, new Set());
    }
    capturedPointerIds.get(this)!.add(pointerId);
  };
  Element.prototype.releasePointerCapture = function (pointerId: number) {
    capturedPointerIds.get(this)?.delete(pointerId);
  };
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
  // Mirrors createTranslator's "always resolve against en.json" behavior:
  // formats with the "en" locale regardless of what the real request would
  // resolve, since tests don't run inside a Next.js request context.
  getFormatter: async () => ({
    dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en", options).format(date),
  }),
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

// lib/db/client.ts: server components (Footer, page.tsx files) check this
// before calling the equipment service, to skip DB access at build time
// when DATABASE_URL is unset (see lib/db/client.ts's isDatabaseConfigured
// docstring). Tests have no DATABASE_URL in their env either, so without
// this mock every one of those call sites would see "not configured" and
// skip straight past the equipment-service mock below.
vi.mock("@/lib/db/client", () => ({
  isDatabaseConfigured: vi.fn(() => true),
}));

// The Postgres-backed service layer (lib/services/equipment.ts): server
// components (Footer, page.tsx files) call this directly, but unit tests
// have no live database, so it resolves from the same fixtures other tests
// use instead of opening a real connection.
vi.mock("@/lib/services/equipment", () => ({
  getAllCameras: vi.fn(async () => CAMERAS),
  getAllLenses: vi.fn(async () => LENSES),
  getCameraBySlug: vi.fn(
    async (slug: string) =>
      CAMERAS.find((camera) => camera.slug === slug) ?? null,
  ),
  getLensBySlug: vi.fn(
    async (slug: string) => LENSES.find((lens) => lens.slug === slug) ?? null,
  ),
}));

beforeEach(() => {
  resetNavigationMocks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
