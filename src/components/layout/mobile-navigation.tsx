"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/class-names";

const sectionLinks = [
  { href: "#services", label: "Services" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
] as const;

export function MobileNavigation({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstLink = menuRef.current?.querySelector<HTMLElement>("a");
    firstLink?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  function focusSection(href: string) {
    closeMenu();
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(href)?.focus({ preventScroll: true });
    });
  }

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        aria-controls="mobile-navigation"
        aria-expanded={open}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="grid size-11 place-items-center rounded-full border bg-surface text-foreground outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <span aria-hidden="true" className="relative block size-5">
          <span
            className={cn(
              "absolute left-0 top-1 block h-px w-5 bg-current transition-transform",
              open && "translate-y-[6px] rotate-45",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-2.5 block h-px w-5 bg-current transition-opacity",
              open && "opacity-0",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-4 block h-px w-5 bg-current transition-transform",
              open && "-translate-y-[6px] -rotate-45",
            )}
          />
        </span>
      </button>

      <nav
        ref={menuRef}
        aria-label="Mobile navigation"
        className={cn(
          "absolute inset-x-0 top-full border-b bg-background px-5 py-5 shadow-[0_18px_35px_-30px_rgba(0,0,0,0.45)] sm:px-8",
          open ? "block" : "hidden",
        )}
        id="mobile-navigation"
      >
        <div className="mx-auto grid max-w-7xl gap-1">
          {sectionLinks.map((link) => (
            <a
              className="rounded-lg px-3 py-3 text-base font-medium outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
              href={link.href}
              key={link.href}
              onClick={() => focusSection(link.href)}
            >
              {link.label}
            </a>
          ))}
          <div className="my-3 border-t" />
          {isAuthenticated ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/app"
              onClick={closeMenu}
            >
              Open workspace
            </Link>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg border bg-surface px-5 text-sm font-semibold outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/login"
                onClick={closeMenu}
              >
                Sign In
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/signup"
                onClick={closeMenu}
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
