import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { LogoutButton } from "@/components/auth/logout-button";
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
        <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Capt. Bob Cedi&apos;s Artworks
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              JobSubmit workspace
            </h1>
          </div>
          <LogoutButton />
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
          <p className="mt-5 border-t pt-5 text-sm leading-6 text-muted">
            This is a Brick 3 verification screen only. Role dashboards and
            business workflows are intentionally not implemented yet.
          </p>
        </Card>
      </Container>
    </main>
  );
}
