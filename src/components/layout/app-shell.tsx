import Link from "next/link";
import type { ReactNode } from "react";

import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { canManageStaffJobs } from "@/domain/staff-job-policy";
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
      <header className="border-b bg-surface/95 shadow-[0_12px_32px_-30px_var(--shadow-color)] backdrop-blur-xl">
        <Container className="flex min-h-20 flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
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
            <nav
              aria-label="Workspace"
              className="-mx-2 flex max-w-full items-center gap-1 overflow-x-auto px-2"
            >
              <Link
                className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                href="/app"
              >
                Home
              </Link>
              {principal.role === "CUSTOMER" ? (
                <>
                  <Link
                    className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    href="/app/jobs/new"
                  >
                    Submit job
                  </Link>
                  <Link
                    className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    href="/app/jobs"
                  >
                    My jobs
                  </Link>
                </>
              ) : null}
              {canManageStaffJobs(principal.role) ? (
                <Link
                  className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  href="/app/staff/jobs"
                >
                  Jobs
                </Link>
              ) : null}
              {principal.role === "ADMIN" || principal.role === "OWNER" ? (
                <>
                  <Link
                    className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    href="/app/services"
                  >
                    Services
                  </Link>
                  <Link
                    className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    href="/app/team"
                  >
                    Team
                  </Link>
                </>
              ) : null}
              {principal.role === "WORKER" ? (
                <Link
                  className="rounded-md px-3 py-2 text-sm text-muted outline-none hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  href="/app/profile"
                >
                  My profile
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Badge>{principal.role}</Badge>
            <LogoutButton />
          </div>
        </Container>
      </header>
      {children}
    </div>
  );
}
