"use client";

import { useSyncExternalStore } from "react";

import {
  getBrowserThemeSnapshot,
  subscribeToBrowserTheme,
  toggleBrowserTheme,
} from "@/lib/theme-browser";
import {
  getThemeToggleLabel,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeSnapshot,
} from "@/lib/theme";
import { cn } from "@/lib/class-names";

const serverSnapshot: ThemeSnapshot = "system:light";

function getServerThemeSnapshot() {
  return serverSnapshot;
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="theme-toggle-icon--moon size-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="theme-toggle-icon--sun size-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="3.75" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2v2.25M12 19.75V22M4.93 4.93l1.59 1.59m10.96 10.96 1.59 1.59M2 12h2.25M19.75 12H22M4.93 19.07l1.59-1.59M17.48 6.52l1.59-1.59"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const snapshot = useSyncExternalStore(
    subscribeToBrowserTheme,
    getBrowserThemeSnapshot,
    getServerThemeSnapshot,
  );
  const [, resolved] = snapshot.split(":") as [
    ThemePreference,
    ResolvedTheme,
  ];
  const label = getThemeToggleLabel(resolved);

  return (
    <button
      aria-label={label}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary-surface hover:text-primary-surface-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={toggleBrowserTheme}
      title={label}
      type="button"
    >
      <MoonIcon />
      <SunIcon />
    </button>
  );
}
