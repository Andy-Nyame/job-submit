"use client";

import {
  isThemePreference,
  readThemePreference,
  ThemeStore,
  type ThemePreference,
} from "./theme";

const themeColors = {
  dark: "#24272d",
  light: "#f7f8fa",
} as const;

let browserThemeStore: ThemeStore | undefined;

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function applyTheme(preference: ThemePreference, resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.add("theme-changing");
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", themeColors[resolved]));

  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove("theme-changing"));
  });
}

function createBrowserThemeStore() {
  const storage = getStorage();
  const initializedPreference = document.documentElement.dataset.themePreference;
  const initialPreference = isThemePreference(initializedPreference)
    ? initializedPreference
    : readThemePreference(storage);

  return new ThemeStore({
    applyTheme,
    initialPreference,
    mediaQuery: window.matchMedia("(prefers-color-scheme: dark)"),
    storage,
  });
}

function getBrowserThemeStore() {
  browserThemeStore ??= createBrowserThemeStore();
  return browserThemeStore;
}

export function getBrowserThemeSnapshot() {
  return getBrowserThemeStore().getSnapshot();
}

export function setBrowserThemePreference(preference: ThemePreference) {
  getBrowserThemeStore().setPreference(preference);
}

export function subscribeToBrowserTheme(listener: () => void) {
  return getBrowserThemeStore().subscribe(listener);
}
