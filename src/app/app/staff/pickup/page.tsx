import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { PickupVerificationPanel } from "@/components/staff-jobs/pickup-verification-panel";
import { canManageOperations } from "@/domain/job-operations";
import { canManageStaffJobs } from "@/domain/staff-job-policy";
import { requireBusinessMembership } from "@/server/auth/authorization";

export const metadata: Metadata = { title: "Verify pickup" };

export default async function PickupPage() {
  const principal = await requireBusinessMembership();
  if (!canManageStaffJobs(principal.role)) redirect("/app");
  return (
    <main className="py-10 sm:py-14" id="main-content">
      <Container className="max-w-4xl">
        <Link className="text-sm font-semibold text-primary underline underline-offset-4" href="/app/staff/jobs">Back to Jobs</Link>
        <header className="mt-6 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Secure handover</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Check and confirm pickup</h1><p className="mt-3 text-sm leading-6 text-muted">Scan the customer&apos;s private code or type it below. Compare every saved requirement with the physical work before confirming collection.</p></header>
        <div className="mt-8"><PickupVerificationPanel canOverride={canManageOperations(principal.role)} /></div>
      </Container>
    </main>
  );
}
