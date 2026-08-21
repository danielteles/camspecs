import { vi } from "vitest";

/**
 * Mocks for `@/i18n/navigation` (next-intl's locale-aware router) and the
 * subset of `next/navigation` components call directly (`useSearchParams`).
 * Stable across re-renders so assertions like
 * `expect(mockRouterReplace).toHaveBeenCalledWith(...)` keep working.
 */
export const mockRouterReplace = vi.fn();
export const mockRouterPush = vi.fn();

export const mockUsePathname = vi.fn<() => string>();
export const mockUseRouter = vi.fn(() => ({
  replace: mockRouterReplace,
  push: mockRouterPush,
}));
export const mockUseSearchParams = vi.fn<() => URLSearchParams>();

/** Resets all navigation mocks to sane defaults; called before every test. */
export function resetNavigationMocks() {
  mockRouterReplace.mockReset();
  mockRouterPush.mockReset();
  mockUsePathname.mockReset().mockReturnValue("/");
  mockUseSearchParams.mockReset().mockReturnValue(new URLSearchParams());
}
