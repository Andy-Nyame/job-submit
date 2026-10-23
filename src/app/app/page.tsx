import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import {
  ApplicationAccessDeniedError,
  AuthenticationRequiredError,
} from "@/server/auth/errors";
import { requireBusinessMembership } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Workspace" };

export default async function ApplicationPage() {
  let principal;

  try {
    principal = await requireBusinessMembership();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?next=/app");
    }
    if (error instanceof ApplicationAccessDeniedError) {
      redirect("/access-denied");
    }
    throw error;
  }

  return (
    <main id="main-content" className="min-h-dvh py-10 sm:py-16">
      <Container className="max-w-3xl">
        <header className="mb-8">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Capt. Bob Cedi&apos;s Artworks
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              JobSubmit workspace
            </h1>
          </div>
        </header>

        <Card>
          <Badge>{principal.role}</Badge>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">
            Authentication confirmed
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Signed in as {principal.displayName ?? principal.email}. Your
            application identity and active business membership were resolved
            on the server.
          </p>
          {principal.role === "CUSTOMER" ? (
            <div className="mt-5 border-t pt-5">
              <p className="text-sm leading-6 text-muted">
                Submit requests for services currently enabled online, attach
                optional private reference files, and return to your submitted
                job details from this workspace.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/app/jobs/new">Submit a job</Link>
                <Link className="inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" href="/app/jobs">View my jobs</Link>
              </div>
            </div>
          ) : (
            <p className="mt-5 border-t pt-5 text-sm leading-6 text-muted">
              OWNER and ADMIN accounts can manage services and workers from the
              workspace navigation. Customer submission is available only to
              active CUSTOMER memberships; staff production workflows remain deferred.
            </p>
          )}
        </Card>
      </Container>
    </main>
  );
}
