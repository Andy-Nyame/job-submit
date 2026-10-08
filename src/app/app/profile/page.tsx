import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { getOwnWorkerProfile } from "@/server/team/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My worker profile" };

export default async function WorkerProfilePage() {
  const principal = await requireBusinessMembership();
  if (principal.role !== "WORKER") {
    redirect("/app");
  }

  const { membership } = await getOwnWorkerProfile();
  if (!membership?.workerProfile) {
    redirect("/access-denied");
  }
  const profile = membership.workerProfile;

  return (
    <main id="main-content" className="py-10 sm:py-14">
      <Container className="max-w-4xl">
        <header className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Worker workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            My profile and capacity
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            These settings are managed by an administrator. This page does not
            provide job claiming or permission changes.
          </p>
        </header>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {membership.user.displayName ?? "Worker"}
                </h2>
                <p className="mt-1 text-sm text-muted">{membership.user.email}</p>
              </div>
              <Badge>{profile.isActive ? "AVAILABLE" : "INACTIVE"}</Badge>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 text-sm">
              <div>
                <dt className="text-muted">QUICK limit</dt>
                <dd className="mt-1 text-xl font-semibold">{profile.maxQuickWorkload}</dd>
              </div>
              <div>
                <dt className="text-muted">STANDARD limit</dt>
                <dd className="mt-1 text-xl font-semibold">
                  {profile.maxStandardWorkload}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">FOCUS eligibility</dt>
                <dd className="mt-1 font-medium">
                  {profile.canTakeFocus ? "Eligible" : "Not eligible"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Qualified services</h2>
            {profile.skills.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No service skills have been configured yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {profile.skills.map((skill) => (
                  <li className="rounded-md border bg-surface-muted p-3 text-sm" key={skill.id}>
                    {skill.service.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Container>
    </main>
  );
}
