import Link from "next/link";

import { siteConfig } from "@/config/site";

import { Container } from "./container";
import { MobileNavigation } from "./mobile-navigation";

const sectionLinks = [
  { href: "#services", label: "Services" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
] as const;

export function SiteHeader({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
      <Container className="flex min-h-20 items-center justify-between gap-6 py-3">
        <Link
          href="/"
          aria-label={`${siteConfig.businessName} — ${siteConfig.productName} home`}
          className="group inline-flex min-w-0 items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <span
            aria-hidden="true"
            className="h-9 w-1 shrink-0 rounded-full bg-accent transition-transform group-hover:scale-y-75"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-[-0.02em] sm:text-base">
              {siteConfig.businessName}
            </span>
            <span className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">
              {siteConfig.productName}
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          <nav aria-label="Primary navigation" className="flex items-center gap-6">
            {sectionLinks.map((link) => (
              <a
                className="rounded-sm text-sm font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {isAuthenticated ? (
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/app"
            >
              Open workspace
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
                href="/login"
              >
                Sign In
              </Link>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="/signup"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        <MobileNavigation isAuthenticated={isAuthenticated} />
      </Container>
    </header>
  );
}
