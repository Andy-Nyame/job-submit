import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { AddInternalNoteForm } from "@/components/staff-jobs/add-internal-note-form";
import { StartJobReviewForm } from "@/components/staff-jobs/start-job-review-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isJobSubmissionSnapshot, type JobSubmissionSnapshot } from "@/domain/job-submission";
import { readSpecificationConfiguration } from "@/domain/service-configuration";
import { formatGhanaCediMinor } from "@/domain/service-pricing";
import { canManageStaffJobs } from "@/domain/staff-job-policy";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { getStaffJobDetail } from "@/server/staff-jobs/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff job review" };

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

function formatBytes(value: bigint) {
  const bytes = Number(value);
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatSize(size: JobSubmissionSnapshot["request"]["size"]) {
  if (size.kind === "NONE") return "Not applicable";
  if (size.kind === "PRESET") return size.option;
  return `${size.width} × ${size.height} ${size.unit.toLowerCase()}`;
}

function fieldLabels(snapshot: JobSubmissionSnapshot) {
  const specification = readSpecificationConfiguration(snapshot.service.specificationConfiguration);
  return new Map(specification?.customerFields.map((field) => [field.id, field.label]) ?? []);
}

interface StaffJobDetailPageProps {
  params: Promise<{ publicReference: string }>;
}

export default async function StaffJobDetailPage({ params }: StaffJobDetailPageProps) {
  const principal = await requireBusinessMembership();
  if (!canManageStaffJobs(principal.role)) {
    redirect("/app");
  }
  const { publicReference } = await params;
  const { job } = await getStaffJobDetail(publicReference);
  if (!job) notFound();

  const snapshot = isJobSubmissionSnapshot(job.submissionSnapshot) ? job.submissionSnapshot : null;
  const labels = snapshot ? fieldLabels(snapshot) : new Map<string, string>();
  const customerName = job.customer?.displayName ?? job.customer?.email ?? "Customer details unavailable";

  return (
    <main className="py-10 sm:py-14" id="main-content">
      <Container>
        <Link className="text-sm font-medium text-muted underline decoration-accent underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/app/staff/jobs">Back to staff inbox</Link>
        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted">{job.publicReference}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{job.title}</h1>
            <p className="mt-2 text-sm text-muted">{snapshot?.service.name ?? job.service.name} · Submitted {formatDate(job.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{formatStatus(job.currentStatus)}</Badge>
            <Badge className={job.priority === "EXPRESS" ? "border-destructive/45 bg-destructive-surface text-destructive" : undefined}>{job.priority === "EXPRESS" ? "Express / Urgent" : "Regular"}</Badge>
            {snapshot?.pricing.mode === "ON_REQUEST" ? <Badge>Quotation pending</Badge> : null}
          </div>
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <div className="space-y-6">
            <Card className="p-5 sm:p-7">
              <h2 className="text-xl font-semibold">Submitted job details</h2>
              {snapshot ? (
                <div className="mt-5 space-y-6 text-sm">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-muted">Service</dt><dd className="mt-1 font-medium">{snapshot.service.name}</dd></div>
                    <div><dt className="text-muted">Quantity</dt><dd className="mt-1 font-medium">{snapshot.request.quantity?.toLocaleString("en-US") ?? "Not applicable"}</dd></div>
                    <div><dt className="text-muted">Size</dt><dd className="mt-1 font-medium">{formatSize(snapshot.request.size)}</dd></div>
                    {snapshot.request.material ? <div><dt className="text-muted">Material</dt><dd className="mt-1 font-medium">{snapshot.request.material}</dd></div> : null}
                    {snapshot.request.finishing ? <div><dt className="text-muted">Finishing</dt><dd className="mt-1 font-medium">{snapshot.request.finishing}</dd></div> : null}
                  </dl>
                  <div><h3 className="font-medium text-muted">Customer instructions</h3><p className="mt-2 whitespace-pre-wrap leading-6">{snapshot.request.instructions || "No additional instructions."}</p></div>
                  {Object.keys(snapshot.request.jobFields).length > 0 ? (
                    <div><h3 className="font-medium text-muted">Service information</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(snapshot.request.jobFields).map(([key, value]) => <div className="rounded-lg border bg-surface-muted p-3" key={key}><dt className="text-xs text-muted">{labels.get(key) ?? key}</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{value}</dd></div>)}</dl></div>
                  ) : null}
                  {snapshot.request.variations.length > 0 ? (
                    <div><h3 className="font-medium text-muted">Variations</h3><ol className="mt-3 space-y-3">{snapshot.request.variations.map((variation, index) => <li className="rounded-lg border bg-surface-muted p-4" key={variation.id}><p className="font-semibold">Variation {index + 1} · {variation.quantity.toLocaleString("en-US")}</p>{Object.entries(variation.fieldValues).map(([key, value]) => <p className="mt-2 text-muted" key={key}>{labels.get(key) ?? key}: <span className="text-foreground">{value}</span></p>)}</li>)}</ol></div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-sm leading-6 text-muted"><p>This legacy job does not contain a Brick 6A submission snapshot.</p><p className="mt-2 whitespace-pre-wrap">{job.instructions}</p></div>
              )}
            </Card>

            <Card className="p-5 sm:p-7">
              <h2 className="text-xl font-semibold">Status history</h2>
              {job.statusHistory.length > 0 ? (
                <ol className="mt-5 space-y-4 border-l border-border-strong pl-5">
                  {job.statusHistory.map((entry) => (
                    <li key={entry.id}>
                      <p className="font-semibold">{entry.fromStatus ? `${formatStatus(entry.fromStatus)} → ` : ""}{formatStatus(entry.toStatus)}</p>
                      <p className="mt-1 text-xs text-muted">{formatDate(entry.createdAt)} · {entry.actorUser?.displayName ?? entry.actorUser?.email ?? "System"}</p>
                      {entry.reason ? <p className="mt-2 text-sm leading-6 text-muted">{entry.reason}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-3 text-sm text-muted">No status history is available.</p>}
            </Card>

            <Card className="p-5 sm:p-7">
              <h2 className="text-xl font-semibold">Internal staff notes</h2>
              <p className="mt-2 text-sm leading-6 text-muted">These notes are never included in customer-facing job queries.</p>
              <div className="mt-5"><AddInternalNoteForm publicReference={job.publicReference} /></div>
              {job.notes.length > 0 ? (
                <ol className="mt-6 space-y-3 border-t pt-5">{job.notes.map((note) => <li className="rounded-xl border bg-surface-muted p-4" key={note.id}><p className="whitespace-pre-wrap text-sm leading-6">{note.body}</p><p className="mt-3 text-xs text-muted">{note.author.user.displayName ?? note.author.user.email ?? "Authorized staff"} · {formatDate(note.createdAt)}</p></li>)}</ol>
              ) : <p className="mt-5 border-t pt-5 text-sm text-muted">No internal notes yet.</p>}
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Review status</h2>
              {job.currentStatus === "SUBMITTED" ? (
                <><p className="mt-2 text-sm leading-6 text-muted">This new request has not entered staff review.</p><div className="mt-5"><StartJobReviewForm publicReference={job.publicReference} version={job.version} /></div></>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted">Current status: <span className="font-medium text-foreground">{formatStatus(job.currentStatus)}</span>{job.reviewedAt ? ` since ${formatDate(job.reviewedAt)}` : ""}.</p>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Pricing snapshot</h2>
              {snapshot?.pricing.mode === "FIXED" ? (
                <><p className="mt-3 text-2xl font-semibold">{formatGhanaCediMinor(BigInt(snapshot.pricing.totalMinor))}</p><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">Base</dt><dd>{formatGhanaCediMinor(BigInt(snapshot.pricing.basePriceMinor))}</dd></div>{snapshot.request.priority === "EXPRESS" ? <div className="flex justify-between gap-4"><dt className="text-muted">Express surcharge</dt><dd>{formatGhanaCediMinor(BigInt(snapshot.pricing.expressSurchargeMinor))}</dd></div> : null}</dl><p className="mt-4 text-xs leading-5 text-muted">Authoritative calculation saved at submission. No payment is recorded.</p></>
              ) : snapshot?.pricing.mode === "ON_REQUEST" ? (
                <><p className="mt-3 font-semibold">Quotation pending</p><p className="mt-2 text-sm leading-6 text-muted">No amount has been fabricated or confirmed. Quotation issuance is a later milestone.</p></>
              ) : <p className="mt-3 text-sm text-muted">No submission pricing snapshot is available.</p>}
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Customer</h2>
              <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted">Name</dt><dd className="mt-1 font-medium">{customerName}</dd></div>{job.customer?.email ? <div><dt className="text-muted">Email</dt><dd className="mt-1 break-all font-medium">{job.customer.email}</dd></div> : null}{job.customer?.phone ? <div><dt className="text-muted">Phone</dt><dd className="mt-1 font-medium">{job.customer.phone}</dd></div> : null}</dl>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Reference files</h2>
              {job.attachments.length > 0 ? <ul className="mt-3 space-y-3">{job.attachments.map((attachment) => <li key={attachment.id}><Link className="block rounded-lg border border-border-strong p-3 text-sm outline-none transition-colors hover:border-primary/45 hover:bg-primary-surface focus-visible:ring-2 focus-visible:ring-ring" href={`/api/jobs/${encodeURIComponent(job.publicReference)}/attachments/${attachment.id}`}><span className="block truncate font-medium">{attachment.originalFilename}</span><span className="mt-1 block text-xs text-muted">{formatBytes(attachment.byteSize)} · {formatStatus(attachment.purpose)} · Private download</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-muted">No files were attached.</p>}
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Record information</h2>
              <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted">Source</dt><dd className="mt-1 font-medium">{formatStatus(job.source)}</dd></div><div><dt className="text-muted">Submitted</dt><dd className="mt-1 font-medium">{formatDate(job.createdAt)}</dd></div><div><dt className="text-muted">Last updated</dt><dd className="mt-1 font-medium">{formatDate(job.updatedAt)}</dd></div></dl>
            </Card>
          </aside>
        </div>
      </Container>
    </main>
  );
}
