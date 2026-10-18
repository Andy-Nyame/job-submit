"use client";

import { useId, useSyncExternalStore } from "react";

import {
  getBrowserThemeSnapshot,
  setBrowserThemePreference,
  subscribeToBrowserTheme,
} from "@/lib/theme-browser";
import {
  isThemePreference,
  themeOptions,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeSnapshot,
} from "@/lib/theme";
import { cn } from "@/lib/class-names";

const serverSnapshot: ThemeSnapshot = "system:light";

function getServerThemeSnapshot() {
  return serverSnapshot;
}

export function ThemeSwitcher({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const selectId = useId();
  const statusId = `${selectId}-status`;
  const snapshot = useSyncExternalStore(
    subscribeToBrowserTheme,
    getBrowserThemeSnapshot,
    getServerThemeSnapshot,
  );
  const [preference, resolved] = snapshot.split(":") as [
    ThemePreference,
    ResolvedTheme,
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        className={showLabel ? "text-sm font-medium text-muted" : "sr-only"}
        htmlFor={selectId}
      >
        Theme
      </label>
      <select
        aria-describedby={statusId}
        className="min-h-10 w-28 rounded-full border bg-input px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        id={selectId}
        onChange={(event) => {
          if (isThemePreference(event.target.value)) {
            setBrowserThemePreference(event.target.value);
          }
        }}
        value={preference}
      >
        {themeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span aria-live="polite" className="sr-only" id={statusId}>
        {preference === "system"
          ? `System theme, currently ${resolved}`
          : `${preference} theme selected`}
      </span>
    </div>
  );
}
