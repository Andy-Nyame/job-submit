"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  getActiveApplicationNavigationHref,
  getApplicationNavigation,
  type ApplicationNavigationIcon,
  type ApplicationNavigationItem,
} from "@/domain/application-navigation";
import type { ApplicationRole } from "@/domain/auth-policy";
import { cn } from "@/lib/class-names";

const DRAWER_ID = "application-navigation-drawer";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const NAVIGATION_ICON_PATHS: Record<ApplicationNavigationIcon, ReactNode> = {
  briefcase: (
    <>
      <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-8Z" />
      <path d="M4 11.5c2.4 1 5.1 1.5 8 1.5s5.6-.5 8-1.5M10.5 12.8v1.7h3v-1.7" />
    </>
  ),
  dashboard: (
    <>
      <rect height="6" rx="1.2" width="6" x="4" y="4" />
      <rect height="6" rx="1.2" width="6" x="14" y="4" />
      <rect height="6" rx="1.2" width="6" x="4" y="14" />
      <rect height="6" rx="1.2" width="6" x="14" y="14" />
    </>
  ),
  "document-add": (
    <>
      <path d="M7 3.5h6l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M13 3.5v4h4M8 14h6M11 11v6" />
    </>
  ),
  documents: (
    <>
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h8A1.5 1.5 0 0 1 19 4.5v11a1.5 1.5 0 0 1-1.5 1.5H16" />
      <rect height="14" rx="1.5" width="11" x="5" y="7" />
      <path d="M8 11h5M8 15h5M8 18h3" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  services: (
    <>
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15 6.2a3 3 0 0 1 0 5.6M16.5 14.2a5.5 5.5 0 0 1 4 4.8" />
    </>
  ),
};

function NavigationIcon({ name }: { name: ApplicationNavigationIcon }) {

  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {NAVIGATION_ICON_PATHS[name]}
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function groupNavigation(items: readonly ApplicationNavigationItem[]) {
  const groups = new Map<string, ApplicationNavigationItem[]>();
  for (const item of items) {
    const group = groups.get(item.group) ?? [];
    group.push(item);
    groups.set(item.group, group);
  }
  return groups;
}

function NavigationLinks({
  activeHref,
  items,
  onNavigate,
}: {
  activeHref: string | null;
  items: readonly ApplicationNavigationItem[];
  onNavigate?: () => void;
}) {
  return Array.from(groupNavigation(items)).map(([group, groupItems]) => (
    <div className="space-y-1" key={group}>
      <p className="px-3 pb-1 pt-3 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">
        {group}
      </p>
      {groupItems.map((item) => {
        const active = activeHref === item.href;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-12 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              active
                ? "border-primary/25 bg-primary-surface text-primary-surface-foreground"
                : "text-muted hover:border-border hover:bg-surface-hover hover:text-foreground",
            )}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
                active
                  ? "border-primary/25 bg-surface-raised text-primary"
                  : "border-border bg-surface-muted text-muted group-hover:text-foreground",
              )}
            >
              <NavigationIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  ));
}

function Brand() {
  return (
    <span className="block min-w-0">
      <span className="block text-sm font-semibold tracking-tight">JobSubmit</span>
      <span className="block truncate font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted">
        Capt. Bob Cedi&apos;s Artworks
      </span>
    </span>
  );
}

interface AppNavigationProps {
  desktopActions: ReactNode;
  displayName: string | null;
  email: string;
  mobileActions: ReactNode;
  role: ApplicationRole;
}

export function AppNavigation({
  desktopActions,
  displayName,
  email,
  mobileActions,
  role,
}: AppNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = getApplicationNavigation(role);
  const activeHref = getActiveApplicationNavigationHref(pathname, items);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    function closeAtDesktopWidth(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }
    desktopQuery.addEventListener("change", closeAtDesktopWidth);
    return () => desktopQuery.removeEventListener("change", closeAtDesktopWidth);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current
      ?.querySelector<HTMLElement>("[data-drawer-initial-focus]")
      ?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function closeDrawer(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh min-h-0 flex-col border-r bg-surface lg:flex">
        <div className="border-b px-5 py-6">
          <Link
            className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
            href="/app"
          >
            <Brand />
          </Link>
        </div>
        <nav aria-label="Workspace" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          <NavigationLinks activeHref={activeHref} items={items} />
        </nav>
        <div className="border-t p-4">
          <div className="mb-4 min-w-0 rounded-xl bg-surface-muted px-3 py-3">
            <p className="truncate text-sm font-semibold">{displayName ?? email}</p>
            {displayName ? <p className="mt-1 truncate text-xs text-muted">{email}</p> : null}
            <Badge className="mt-2">{role}</Badge>
          </div>
          {desktopActions}
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b bg-surface/95 px-4 shadow-[0_12px_32px_-30px_var(--shadow-color)] backdrop-blur-xl sm:px-6 lg:hidden">
        <Link
          className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          href="/app"
        >
          <Brand />
        </Link>
        <button
          ref={triggerRef}
          aria-controls={DRAWER_ID}
          aria-expanded={open}
          aria-label={open ? "Close workspace menu" : "Open workspace menu"}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-border-strong bg-surface text-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary-surface hover:text-primary-surface-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <MenuIcon open={open} />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-hidden="true"
            className="absolute inset-0 size-full cursor-default bg-foreground/35 backdrop-blur-[1px]"
            onClick={() => closeDrawer(true)}
            tabIndex={-1}
            type="button"
          />
          <aside
            ref={drawerRef}
            aria-labelledby="workspace-menu-title"
            aria-modal="true"
            className="relative flex h-dvh w-[min(88vw,20rem)] min-w-0 flex-col border-r bg-surface shadow-[18px_0_50px_-24px_var(--shadow-color)]"
            id={DRAWER_ID}
            role="dialog"
          >
            <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4">
              <div className="min-w-0" id="workspace-menu-title">
                <Brand />
              </div>
              <button
                aria-label="Close workspace menu"
                className="grid size-11 shrink-0 place-items-center rounded-lg border border-border-strong bg-surface text-foreground outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                data-drawer-initial-focus
                onClick={() => closeDrawer(true)}
                type="button"
              >
                <MenuIcon open />
              </button>
            </div>
            <nav aria-label="Workspace" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
              <NavigationLinks
                activeHref={activeHref}
                items={items}
                onNavigate={() => closeDrawer(false)}
              />
            </nav>
            <div className="border-t p-4">
              <div className="mb-4 min-w-0 rounded-xl bg-surface-muted px-3 py-3">
                <p className="truncate text-sm font-semibold">{displayName ?? email}</p>
                {displayName ? <p className="mt-1 truncate text-xs text-muted">{email}</p> : null}
                <Badge className="mt-2">{role}</Badge>
              </div>
              {mobileActions}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
