import assert from "node:assert/strict";
import test from "node:test";

import {
  readThemePreference,
  THEME_STORAGE_KEY,
  themeOptions,
  ThemeStore,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeStorage,
} from "./theme";

class MemoryStorage implements ThemeStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class MockMediaQuery {
  matches: boolean;
  private listeners = new Set<() => void>();

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(_type: "change", listener: () => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "change", listener: () => void) {
    this.listeners.delete(listener);
  }

  setMatches(matches: boolean) {
    this.matches = matches;
    this.listeners.forEach((listener) => listener());
  }
}

function setup({
  saved,
  systemDark = false,
  storage = new MemoryStorage(),
}: {
  saved?: ThemePreference;
  systemDark?: boolean;
  storage?: ThemeStorage;
} = {}) {
  if (saved) {
    storage.setItem(THEME_STORAGE_KEY, saved);
  }

  const applied: Array<[ThemePreference, ResolvedTheme]> = [];
  const mediaQuery = new MockMediaQuery(systemDark);
  const store = new ThemeStore({
    applyTheme: (preference, resolved) => applied.push([preference, resolved]),
    mediaQuery,
    storage,
  });

  return { applied, mediaQuery, storage, store };
}

test("defaults to System and resolves the current light OS preference", () => {
  const { applied, store } = setup();

  assert.equal(store.getSnapshot(), "system:light");
  assert.deepEqual(applied, [["system", "light"]]);
  store.destroy();
});

test("selects and persists explicit Light mode", () => {
  const { applied, storage, store } = setup({ systemDark: true });

  store.setPreference("light");

  assert.equal(store.getSnapshot(), "light:light");
  assert.equal(storage.getItem(THEME_STORAGE_KEY), "light");
  assert.deepEqual(applied.at(-1), ["light", "light"]);
  store.destroy();
});

test("selects and persists explicit Dark mode", () => {
  const { applied, storage, store } = setup();

  store.setPreference("dark");

  assert.equal(store.getSnapshot(), "dark:dark");
  assert.equal(storage.getItem(THEME_STORAGE_KEY), "dark");
  assert.deepEqual(applied.at(-1), ["dark", "dark"]);
  store.destroy();
});

test("follows OS preference changes while System is selected", () => {
  const { applied, mediaQuery, store } = setup();

  mediaQuery.setMatches(true);

  assert.equal(store.getSnapshot(), "system:dark");
  assert.deepEqual(applied.at(-1), ["system", "dark"]);
  store.destroy();
});

test("restores a valid saved preference", () => {
  const { store } = setup({ saved: "dark" });

  assert.equal(store.getSnapshot(), "dark:dark");
  store.destroy();
});

test("an explicit preference ignores later OS changes", () => {
  const { applied, mediaQuery, store } = setup({ saved: "light" });
  const initialApplicationCount = applied.length;

  mediaQuery.setMatches(true);

  assert.equal(store.getSnapshot(), "light:light");
  assert.equal(applied.length, initialApplicationCount);
  store.destroy();
});

test("invalid saved values safely fall back to System", () => {
  const storage = new MemoryStorage();
  storage.setItem(THEME_STORAGE_KEY, "sepia");

  assert.equal(readThemePreference(storage), "system");
});

test("storage read and write failures do not break theme changes", () => {
  const storage: ThemeStorage = {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
  };
  const { store } = setup({ storage });

  assert.equal(store.getSnapshot(), "system:light");
  assert.doesNotThrow(() => store.setPreference("dark"));
  assert.equal(store.getSnapshot(), "dark:dark");
  store.destroy();
});

test("theme choices expose concise accessible labels", () => {
  assert.deepEqual(
    themeOptions.map(({ label, value }) => [label, value]),
    [
      ["Light", "light"],
      ["Dark", "dark"],
      ["System", "system"],
    ],
  );
});
