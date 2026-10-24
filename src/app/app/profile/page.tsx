import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { getOwnWorkerProfile } from "@/server/team/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Account" };

function roleLabel(role: string) {
  return role === "CUSTOMER"
    ? "Customer"
    : role === "WORKER"
      ? "Worker"
      : role === "ADMIN"
        ? "Administrator"
        : "Owner";
}

export default async function AccountPage() {
  const principal = await requireBusinessMembership();
  const worker =
    principal.role === "WORKER" ? await getOwnWorkerProfile() : null;
  const profile = worker?.membership?.workerProfile ?? null;

  return (
    <main id="main-content" className="py-10 sm:py-14">
      <Container className="max-w-4xl">
        <header className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Account
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            My Account
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Check the personal details and access connected to this signed-in account.
          </p>
        </header>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {principal.displayName ?? "Name not provided"}
                </h2>
                <p className="mt-1 break-all text-sm text-muted">{principal.email}</p>
              </div>
              <Badge>{roleLabel(principal.role)}</Badge>
            </div>
            <p className="mt-5 border-t pt-5 text-sm leading-6 text-muted">
              Your sign-in details are protected by the existing account system.
              Contact authorized management if your business access needs to change.
            </p>
          </Card>

          {principal.role === "WORKER" ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">Work settings</h2>
                <Badge>{profile?.isActive ? "AVAILABLE" : "INACTIVE"}</Badge>
              </div>
              {profile ? (
                <>
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-5 text-sm">
                    <div>
                      <dt className="text-muted">Quick job limit</dt>
                      <dd className="mt-1 text-xl font-semibold">{profile.maxQuickWorkload}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Standard job limit</dt>
                      <dd className="mt-1 text-xl font-semibold">{profile.maxStandardWorkload}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted">Focus work</dt>
                      <dd className="mt-1 font-medium">
                        {profile.canTakeFocus ? "Eligible" : "Not eligible"}
                      </dd>
                    </div>
                  </dl>
                  <h3 className="mt-6 font-semibold">Services you can handle</h3>
                  {profile.skills.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {profile.skills.map((skill) => (
                        <li className="rounded-md border bg-surface-muted p-3 text-sm" key={skill.id}>
                          {skill.service.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted">No service skills are set yet.</p>
                  )}
                </>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Your worker settings are not available. Ask an administrator for help.
                </p>
              )}
              <p className="mt-5 text-xs leading-5 text-muted">
                An Owner or Admin manages these limits and permissions.
              </p>
            </Card>
          ) : (
            <Card>
              <h2 className="text-lg font-semibold">Appearance</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Use the theme control in the application menu to choose Light,
                Dark, or System appearance on this device.
              </p>
            </Card>
          )}
        </div>
      </Container>
    </main>
  );
}
