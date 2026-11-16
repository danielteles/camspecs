export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value);
}

/** The saved choice; "system" when nothing (or garbage) is stored. */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Storage can throw in private windows or with site data blocked.
    return "system";
  }
}

export function writeStoredTheme(theme: Theme) {
  try {
    if (theme === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Unsaved, but still applied for this page view.
  }
}

export function resolveTheme(
  theme: Theme,
  prefersDark: boolean,
): "light" | "dark" {
  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }
  return theme;
}

export function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia(DARK_QUERY).matches;
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(theme, prefersDark) === "dark",
  );
}

/*
 * Runs in <head> while the HTML is still parsing, so the stored theme is on
 * <html> before first paint even though every page is prerendered with no
 * theme (see node_modules/next/dist/docs/01-app/02-guides/
 * preventing-flash-before-hydration.md). It mirrors readStoredTheme +
 * applyTheme above, since it can't import them, and it stays subscribed for
 * the life of the document: an OS theme change re-resolves "system", and a
 * choice made in another tab is picked up via the storage event.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,m=window.matchMedia(${JSON.stringify(DARK_QUERY)});function a(){var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}d.classList.toggle("dark",t==="dark"||(t!=="light"&&m.matches))}a();m.addEventListener("change",a);window.addEventListener("storage",function(e){if(e.key===${JSON.stringify(THEME_STORAGE_KEY)})a()})}catch(e){}})()`;
