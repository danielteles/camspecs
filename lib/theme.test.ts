import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readStoredTheme,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  writeStoredTheme,
} from "@/lib/theme";

function mockPrefersDark(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
  );
}

function runInitScript() {
  // Runs the exact string the layouts inline into <head>. Indirect eval,
  // because this jsdom setup doesn't execute inserted <script> elements.
  (0, eval)(THEME_INIT_SCRIPT);
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.restoreAllMocks();
});

describe("resolveTheme", () => {
  it("follows the OS preference for the system theme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("ignores the OS preference for an explicit choice", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("stored theme", () => {
  it("reads back an explicit choice", () => {
    writeStoredTheme("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("clears storage when the system theme is chosen", () => {
    writeStoredTheme("light");
    writeStoredTheme("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readStoredTheme()).toBe("system");
  });

  it("treats an unknown stored value as the system theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readStoredTheme()).toBe("system");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("applies a stored dark theme over a light OS preference", () => {
    mockPrefersDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runInitScript();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("applies a stored light theme over a dark OS preference", () => {
    mockPrefersDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInitScript();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("follows a dark OS preference when nothing is stored", () => {
    mockPrefersDark(true);
    runInitScript();
    expect(document.documentElement).toHaveClass("dark");
  });
});
