import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { WorkerSettingsForm } from "@/components/team/worker-settings-form";
import { WorkerStatusForm } from "@/components/team/worker-status-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { getManagedWorker } from "@/server/team/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage worker" };

interface WorkerPageProps {
  params: Promise<{ membershipId: string }>;
}

export default async function WorkerPage({ params }: WorkerPageProps) {
  const principal = await requireBusinessMembership();
  if (principal.role !== "OWNER" && principal.role !== "ADMIN") {
    redirect("/app");
  }

  const { membershipId } = await params;
  const { membership, services } = await getManagedWorker(membershipId);
  if (!membership?.workerProfile) {
    notFound();
  }

  const profile = membership.workerProfile;
  const active =
    membership.status === "ACTIVE" &&
    !membership.deactivatedAt &&
    !membership.user.deactivatedAt &&
    profile.isActive &&
    !profile.archivedAt;
  const selectedServices = new Set(
    profile.skills
      .filter((skill) => skill.isActive)
      .map((skill) => skill.serviceId),
  );

  return (
    <main id="main-content" className="py-10 sm:py-14">
      <Container className="max-w-4xl">
        <Link
          className="text-sm font-medium text-muted underline decoration-accent underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/app/team"
        >
          Back to team
        </Link>
        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Worker profile
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {membership.user.displayName ?? "Unnamed worker"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {membership.user.email ?? "No contact email"}
            </p>
          </div>
          <Badge>{profile.archivedAt ? "ARCHIVED" : active ? "ACTIVE" : "INACTIVE"}</Badge>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Card>
            <h2 className="text-xl font-semibold">Worker settings</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Capacity is configuration only. Assignment and claim enforcement
              will be transactional in the future queue brick.
            </p>
            <div className="mt-6">
              <WorkerSettingsForm
                canTakeFocus={profile.canTakeFocus}
                displayName={membership.user.displayName ?? ""}
                maxQuickWorkload={profile.maxQuickWorkload}
                maxStandardWorkload={profile.maxStandardWorkload}
                membershipId={membership.id}
                profileVersion={profile.version}
                services={services.map((service) => ({
                  checked: selectedServices.has(service.id),
                  id: service.id,
                  name: service.name,
                }))}
              />
            </div>
          </Card>

          <Card className="h-fit p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Access status</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Deactivation immediately removes operational authorization and
              preserves membership history.
            </p>
            <div className="mt-5">
              <WorkerStatusForm
                active={active}
                membershipId={membership.id}
                membershipVersion={membership.version}
                profileVersion={profile.version}
              />
            </div>
          </Card>
        </div>
      </Container>
    </main>
  );
}
