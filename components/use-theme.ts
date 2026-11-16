"use client";

import { useSyncExternalStore } from "react";

import {
  applyTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme,
} from "@/lib/theme";
import type { Theme } from "@/lib/theme";

// The `storage` event only fires in *other* tabs, so same-tab writes notify
// subscribers directly.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot(): Theme {
  return "system";
}

export function setTheme(theme: Theme) {
  writeStoredTheme(theme);
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

/** The saved theme choice — not the resolved light/dark appearance. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readStoredTheme, getServerSnapshot);
}
