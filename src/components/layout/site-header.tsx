import Link from "next/link";

import { siteConfig } from "@/config/site";

import { Container } from "./container";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/95">
      <Container className="flex min-h-20 items-center justify-between gap-6 py-4">
        <Link
          href="/"
          aria-label={`${siteConfig.businessName} — ${siteConfig.productName} home`}
          className="group inline-flex min-w-0 items-center gap-3 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-2 ring-accent/70 ring-offset-2 ring-offset-background"
          >
            CB
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium tracking-tight">
              {siteConfig.businessName}
            </span>
            <span className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">
              {siteConfig.productName}
            </span>
          </span>
        </Link>

        <span className="hidden text-xs font-medium uppercase tracking-[0.14em] text-muted sm:block">
          Project foundation
        </span>
      </Container>
    </header>
  );
}
