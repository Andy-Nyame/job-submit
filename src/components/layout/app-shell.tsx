import Link from "next/link";
import type { ReactNode } from "react";

import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { Container } from "./container";

export function AppShell({
  children,
  principal,
}: {
  children: ReactNode;
  principal: ApplicationPrincipal;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-background/95">
        <Container className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-5">
            <Link
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              href="/app"
            >
              <span className="block text-sm font-semibold tracking-tight">
                JobSubmit
              </span>
              <span className="block font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted">
                Capt. Bob Cedi&apos;s Artworks
              </span>
            </Link>
            <nav aria-label="Workspace" className="flex items-center gap-1">
              <Link
                className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                href="/app"
              >
                Home
              </Link>
              {principal.role === "ADMIN" || principal.role === "OWNER" ? (
                <Link
                  className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  href="/app/team"
                >
                  Team
                </Link>
              ) : null}
              {principal.role === "WORKER" ? (
                <Link
                  className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  href="/app/profile"
                >
                  My profile
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Badge>{principal.role}</Badge>
            <LogoutButton />
          </div>
        </Container>
      </header>
      {children}
    </div>
  );
}
