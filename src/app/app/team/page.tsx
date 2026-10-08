import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { InviteWorkerForm } from "@/components/team/invite-worker-form";
import { InvitationControls } from "@/components/team/invitation-controls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { requireBusinessMembership } from "@/server/auth/authorization";
import {
  getTeamPageData,
  type WorkerListFilter,
} from "@/server/team/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team" };

const workerFilters = new Set<WorkerListFilter>([
  "ALL",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
]);

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function workerStatus(worker: {
  membershipStatus: "ACTIVE" | "INACTIVE";
  profile: { archivedAt: Date | null; isActive: boolean } | null;
  userDeactivatedAt: Date | null;
}) {
  if (worker.profile?.archivedAt) {
    return "ARCHIVED";
  }
  if (
    worker.membershipStatus === "ACTIVE" &&
    worker.profile?.isActive &&
    !worker.userDeactivatedAt
  ) {
    return "ACTIVE";
  }
  return "INACTIVE";
}

interface TeamPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const principal = await requireBusinessMembership();
  if (principal.role !== "OWNER" && principal.role !== "ADMIN") {
    redirect("/app");
  }

  const params = await searchParams;
  const requestedStatus = (params.status?.toUpperCase() ?? "ALL") as WorkerListFilter;
  const status = workerFilters.has(requestedStatus) ? requestedStatus : "ALL";
  const query = params.q?.slice(0, 160) ?? "";
  const data = await getTeamPageData({ query, status });

  return (
    <main id="main-content" className="py-10 sm:py-14">
      <Container>
        <header className="max-w-3xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Team &amp; workers
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Worker access and capacity
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Invite verified identities, configure production skills, and control
            operational access. No invitation email is sent in this brick.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="workers-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-xl font-semibold" id="workers-heading">
                Workers
              </h2>
              <form className="grid w-full gap-3 sm:grid-cols-[1fr_10rem_auto] lg:max-w-2xl">
                <div>
                  <label className="sr-only" htmlFor="worker-search">
                    Search workers
                  </label>
                  <Input
                    defaultValue={query}
                    id="worker-search"
                    name="q"
                    placeholder="Search name or email"
                    type="search"
                  />
                </div>
                <div>
                  <label className="sr-only" htmlFor="worker-status-filter">
                    Filter by status
                  </label>
                  <Select defaultValue={status} id="worker-status-filter" name="status">
                    <option value="ALL">All states</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ARCHIVED">Archived</option>
                  </Select>
                </div>
                <button
                  className="min-h-11 rounded-md border bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  type="submit"
                >
                  Apply
                </button>
              </form>
            </div>

            {data.workers.length === 0 ? (
              <Card className="mt-5">
                <p className="text-sm text-muted">
                  No workers match the current search and filter.
                </p>
              </Card>
            ) : (
              <div className="mt-5 grid gap-4">
                {data.workers.map((worker) => {
                  const statusLabel = workerStatus(worker);
                  return (
                    <Card className="p-5 sm:p-6" key={worker.id}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="font-semibold">
                            {worker.displayName ?? "Unnamed worker"}
                          </h3>
                          <p className="mt-1 truncate text-sm text-muted">
                            {worker.email ?? "No contact email"}
                          </p>
                          <p className="mt-2 text-xs text-muted">
                            {worker.profile?.skillCount ?? 0} active skills
                          </p>
                        </div>
                        <Badge>{statusLabel}</Badge>
                      </div>
                      <Link
                        className="mt-5 inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
                        href={`/app/team/workers/${worker.id}`}
                      >
                        Manage worker
                      </Link>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Invite worker</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                The link expires after seven days and must be redeemed by the
                exact verified email.
              </p>
              <div className="mt-5">
                <InviteWorkerForm />
              </div>
            </Card>

            <section aria-labelledby="invitations-heading">
              <h2 className="text-lg font-semibold" id="invitations-heading">
                Invitations
              </h2>
              {data.invitations.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No invitations yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {data.invitations.map((invitation) => (
                    <Card className="p-4" key={invitation.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="break-all text-sm font-medium">
                          {invitation.email}
                        </p>
                        <Badge>{invitation.status}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        Created {formatDate(invitation.createdAt)}
                        <br />
                        Expires {formatDate(invitation.expiresAt)}
                      </p>
                      <InvitationControls
                        canReissue={invitation.canReissue}
                        canRevoke={invitation.status === "PENDING"}
                        invitationId={invitation.id}
                        version={invitation.version}
                      />
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </Container>
    </main>
  );
}
