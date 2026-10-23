export const THEME_STORAGE_KEY = "jobsubmit-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemePreference, "system">;
export type ThemeSnapshot = `${ThemePreference}:${ResolvedTheme}`;

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeMediaQuery {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

interface ThemeStoreOptions {
  applyTheme: (preference: ThemePreference, resolved: ResolvedTheme) => void;
  initialPreference?: ThemePreference;
  mediaQuery: ThemeMediaQuery;
  storage?: ThemeStorage;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readThemePreference(storage?: ThemeStorage): ThemePreference {
  if (!storage) {
    return "system";
  }

  try {
    const savedPreference = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(savedPreference) ? savedPreference : "system";
  } catch {
    return "system";
  }
}

export function saveThemePreference(
  storage: ThemeStorage | undefined,
  preference: ThemePreference,
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A blocked or full storage area must not prevent in-session theme changes.
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return preference;
}

export function getOppositeTheme(theme: ResolvedTheme): ResolvedTheme {
  return theme === "light" ? "dark" : "light";
}

export function getThemeToggleLabel(theme: ResolvedTheme) {
  return `Switch to ${getOppositeTheme(theme)} mode`;
}

export class ThemeStore {
  private readonly applyTheme: ThemeStoreOptions["applyTheme"];
  private readonly listeners = new Set<() => void>();
  private readonly mediaQuery: ThemeMediaQuery;
  private readonly storage?: ThemeStorage;
  private preference: ThemePreference;

  constructor({
    applyTheme,
    initialPreference,
    mediaQuery,
    storage,
  }: ThemeStoreOptions) {
    this.applyTheme = applyTheme;
    this.mediaQuery = mediaQuery;
    this.storage = storage;
    this.preference = initialPreference ?? readThemePreference(storage);
    this.mediaQuery.addEventListener("change", this.handleSystemChange);
    this.applyCurrentTheme();
  }

  getSnapshot = (): ThemeSnapshot => {
    return `${this.preference}:${this.resolvedTheme}`;
  };

  setPreference = (preference: ThemePreference) => {
    if (this.preference === preference) {
      return;
    }

    this.preference = preference;
    saveThemePreference(this.storage, preference);
    this.applyCurrentTheme();
    this.emitChange();
  };

  toggleTheme = () => {
    this.setPreference(getOppositeTheme(this.resolvedTheme));
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  destroy() {
    this.mediaQuery.removeEventListener("change", this.handleSystemChange);
    this.listeners.clear();
  }

  private get resolvedTheme() {
    return resolveTheme(this.preference, this.mediaQuery.matches);
  }

  private applyCurrentTheme() {
    this.applyTheme(this.preference, this.resolvedTheme);
  }

  private emitChange() {
    this.listeners.forEach((listener) => listener());
  }

  private handleSystemChange = () => {
    if (this.preference !== "system") {
      return;
    }

    this.applyCurrentTheme();
    this.emitChange();
  };
}

export const themeInitializationScript = `(() => {
  const root = document.documentElement;
  root.classList.add("theme-changing");
  const key = ${JSON.stringify(THEME_STORAGE_KEY)};
  let preference = "system";
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark" || saved === "system") preference = saved;
  } catch {}
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", resolved === "dark" ? "#181c23" : "#f5f7fb");
  });
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-changing")));
})();`;
