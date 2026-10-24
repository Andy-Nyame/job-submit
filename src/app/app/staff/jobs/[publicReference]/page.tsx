import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { AddInternalNoteForm } from "@/components/staff-jobs/add-internal-note-form";
import {
  AssignJobForm,
  ClaimJobForm,
  ClearDesignDependencyForm,
  PackageCountForm,
  ProductionStatusForm,
  QueueOverrideForm,
  ReassignJobForm,
  ReissuePickupForm,
  ReleaseJobForm,
} from "@/components/staff-jobs/job-operation-controls";
import { StartJobReviewForm } from "@/components/staff-jobs/start-job-review-form";
import { QuotationDraftForm } from "@/components/quotations/quotation-draft-form";
import { CreateRevisionForm, DeclineCounterofferForm, IssueQuotationForm, WithdrawQuotationForm } from "@/components/quotations/management-quotation-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isJobSubmissionSnapshot, type JobSubmissionSnapshot } from "@/domain/job-submission";
import { canManageOperations } from "@/domain/job-operations";
import { canManageQuotations, effectiveQuotationStatus, expressSurchargeLabel, readQuotationLineItems } from "@/domain/quotation-policy";
import { readSpecificationConfiguration } from "@/domain/service-configuration";
import { formatGhanaCediMinor, formatMoneyInput } from "@/domain/service-pricing";
import { canManageStaffJobs } from "@/domain/staff-job-policy";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { getStaffJobDetail } from "@/server/staff-jobs/queries";
import { getManagementQuotationData } from "@/server/quotations/queries";

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
  const { job, workers } = await getStaffJobDetail(publicReference);
  if (!job) notFound();
  const managementJob = canManageQuotations(principal.role)
    ? (await getManagementQuotationData(publicReference)).job
    : null;

  const snapshot = isJobSubmissionSnapshot(job.submissionSnapshot) ? job.submissionSnapshot : null;
  const labels = snapshot ? fieldLabels(snapshot) : new Map<string, string>();
  const customerName = job.customer?.displayName ?? job.customer?.email ?? "Customer details unavailable";
  const quotationDraft = managementJob?.quotations.find((quotation) => quotation.status === "DRAFT") ?? null;
  const acceptedQuotation = managementJob?.quotations.find((quotation) => quotation.status === "ACCEPTED") ?? null;
  const publicQuotation = job.quotations[0] ?? null;
  const publicQuotationStatus = publicQuotation ? effectiveQuotationStatus(publicQuotation.status, publicQuotation.expiresAt) : null;
  const activeAssignment = job.assignments.find((assignment) => !assignment.releasedAt) ?? null;
  const actorOwnsAssignment = activeAssignment?.workerMembershipId === principal.membershipId;
  const manager = canManageOperations(principal.role);
  const operationWorkers = workers.map((worker) => ({
    disabled: !worker.eligibleForJob || activeAssignment?.workerMembershipId === worker.id,
    id: worker.id,
    label: `${worker.user.displayName ?? worker.user.email ?? "Worker"} · Quick ${worker.workload.quick}/${worker.workerProfile?.maxQuickWorkload ?? 0} · Standard ${worker.workload.standard}/${worker.workerProfile?.maxStandardWorkload ?? 0} · Focus ${worker.workload.focus}/${worker.workerProfile?.canTakeFocus ? 1 : 0}${worker.eligibleForJob ? "" : " · Capacity unavailable"}`,
  }));

  return (
    <main className="py-10 sm:py-14" id="main-content">
      <Container>
        <Link className="text-sm font-medium text-muted underline decoration-accent underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/app/staff/jobs">Back to staff inbox</Link>
        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Job number</p>
            <p className="mt-1 break-all font-mono text-2xl font-black tracking-tight text-primary sm:text-3xl">{job.publicReference}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{job.title}</h1>
            <p className="mt-2 text-sm text-muted">{snapshot?.service.name ?? job.service.name} · Submitted {formatDate(job.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{formatStatus(job.currentStatus)}</Badge>
            <Badge className={job.priority === "EXPRESS" ? "border-destructive/45 bg-destructive-surface text-destructive" : undefined}>{job.priority === "EXPRESS" ? "Express / Urgent" : "Regular"}</Badge>
            {snapshot?.pricing.mode === "ON_REQUEST" ? <Badge>Quotation pending</Badge> : null}
          </div>
        </header>
        <nav aria-label="Job tools" className="mt-5 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" href={`/app/staff/jobs/${encodeURIComponent(job.publicReference)}/label`}>Print job label</Link>
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" href="/app/staff/pickup">Scan pickup code</Link>
        </nav>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <div className="space-y-6">
            <Card className="p-5 sm:p-7">
              <h2 className="text-xl font-semibold">Submitted job details</h2>
              {job.submissionGroupReference ? <div className="mt-4 rounded-lg border bg-surface-muted p-4 text-sm"><p className="font-medium">Linked request group {job.submissionGroupReference}</p>{job.dependsOn ? <p className="mt-2 text-muted">Waiting on <Link className="font-medium text-primary underline" href={`/app/staff/jobs/${encodeURIComponent(job.dependsOn.publicReference)}`}>{job.dependsOn.service.name} · {job.dependsOn.publicReference}</Link>{job.dependencyClearedAt ? " · dependency cleared" : " · confirmation still required"}</p> : null}{job.dependentJobs.map((dependent) => <p className="mt-2 text-muted" key={dependent.publicReference}>Linked printing job: <Link className="font-medium text-primary underline" href={`/app/staff/jobs/${encodeURIComponent(dependent.publicReference)}`}>{dependent.service.name} · {dependent.publicReference}</Link></p>)}</div> : null}
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

            {snapshot?.pricing.mode === "ON_REQUEST" && managementJob ? (
              <Card className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Management costing</h2><p className="mt-2 text-sm leading-6 text-muted">Draft financial terms remain management-only. Issuing freezes the amount, validity, and current service negotiation policy.</p></div><Badge>{managementJob.service.allowPriceNegotiation ? "Negotiation allowed" : "Negotiation off"}</Badge></div>

                {quotationDraft ? (
                  <div className="mt-6 space-y-5 rounded-xl border bg-surface-muted p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">Draft {quotationDraft.publicReference} · Version {quotationDraft.quotationVersion}</p><p className="mt-2 text-xl font-semibold">{formatGhanaCediMinor(quotationDraft.totalMinor)}</p></div><Badge>Private draft</Badge></div>
                    <QuotationDraftForm initialCustomerNote={quotationDraft.customerNote ?? ""} initialItems={readQuotationLineItems(quotationDraft.lineItems).map((item) => ({ amount: formatMoneyInput(item.amountMinor), description: item.description, kind: item.kind }))} initialValidityDays={quotationDraft.validityDays} priority={managementJob.priority} publicReference={job.publicReference} quotationId={quotationDraft.id} rowVersion={quotationDraft.rowVersion} />
                    <div className="grid gap-4 border-t pt-5 sm:grid-cols-2"><IssueQuotationForm publicReference={job.publicReference} quotationId={quotationDraft.id} rowVersion={quotationDraft.rowVersion} /><WithdrawQuotationForm publicReference={job.publicReference} quotationId={quotationDraft.id} rowVersion={quotationDraft.rowVersion} /></div>
                  </div>
                ) : !acceptedQuotation ? (
                  <div className="mt-6"><QuotationDraftForm priority={managementJob.priority} publicReference={job.publicReference} /></div>
                ) : (
                  <p className="mt-5 rounded-lg border border-success/40 bg-success/10 p-4 text-sm leading-6">The customer accepted quotation version {acceptedQuotation.quotationVersion}. Its amount is the agreed job price; no production or payment state changed automatically.</p>
                )}

                {managementJob.quotations.filter((quotation) => quotation.status !== "DRAFT").length > 0 ? (
                  <div className="mt-8 border-t pt-6"><h3 className="font-semibold">Quotation history</h3><ol className="mt-4 space-y-4">{managementJob.quotations.filter((quotation) => quotation.status !== "DRAFT").map((quotation) => {
                    const state = effectiveQuotationStatus(quotation.status, quotation.expiresAt);
                    const items = readQuotationLineItems(quotation.lineItems);
                    const pendingCounteroffer = quotation.counteroffers.find((offer) => offer.status === "PENDING");
                    return <li className="rounded-xl border bg-surface p-4" key={quotation.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">{quotation.publicReference} · Version {quotation.quotationVersion}</p><p className="mt-2 text-lg font-semibold">{formatGhanaCediMinor(quotation.totalMinor)}</p></div><Badge>{formatStatus(state)}</Badge></div><dl className="mt-4 space-y-2 text-sm">{items.map((item, index) => <div className="flex justify-between gap-4" key={`${item.description}-${index}`}><dt className="text-muted">{item.description}</dt><dd>{formatGhanaCediMinor(BigInt(item.amountMinor))}</dd></div>)}<div className="flex justify-between gap-4 border-t pt-2"><dt className="text-muted">Subtotal</dt><dd>{formatGhanaCediMinor(quotation.subtotalMinor)}</dd></div>{quotation.expressSurchargeMinor > 0n ? <div className="flex justify-between gap-4"><dt className="text-muted">{expressSurchargeLabel(quotation.expressSurchargeBasisPoints)}</dt><dd>{formatGhanaCediMinor(quotation.expressSurchargeMinor)}</dd></div> : null}</dl><p className="mt-3 text-xs leading-5 text-muted">Issued {quotation.issuedAt ? formatDate(quotation.issuedAt) : "not issued"} · Valid until {formatDate(quotation.expiresAt)} · Negotiation {quotation.negotiationAllowed ? "allowed" : "off"}</p>
                    {pendingCounteroffer ? <div className="mt-4 rounded-lg border border-accent/45 bg-accent/10 p-4"><p className="font-semibold">Customer counteroffer: {formatGhanaCediMinor(pendingCounteroffer.amountMinor)}</p>{pendingCounteroffer.customerNote ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{pendingCounteroffer.customerNote}</p> : null}<div className="mt-4 grid gap-4 sm:grid-cols-2"><DeclineCounterofferForm counterofferId={pendingCounteroffer.id} publicReference={job.publicReference} />{!quotationDraft ? <CreateRevisionForm publicReference={job.publicReference} quotationId={quotation.id} rowVersion={quotation.rowVersion} /> : null}</div></div> : null}
                    {!quotationDraft && ["ISSUED", "DECLINED", "EXPIRED", "WITHDRAWN"].includes(state) && !pendingCounteroffer ? <div className="mt-4"><CreateRevisionForm publicReference={job.publicReference} quotationId={quotation.id} rowVersion={quotation.rowVersion} /></div> : null}
                    {state === "ISSUED" ? <div className="mt-4"><WithdrawQuotationForm publicReference={job.publicReference} quotationId={quotation.id} rowVersion={quotation.rowVersion} /></div> : null}
                    </li>;
                  })}</ol></div>
                ) : null}
              </Card>
            ) : null}

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
              <h2 className="text-lg font-semibold">Production</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-muted">Worker</dt><dd className="mt-1 font-medium">{activeAssignment?.worker.user.displayName ?? activeAssignment?.worker.user.email ?? "Not assigned"}</dd></div>
                <div><dt className="text-muted">Physical packages</dt><dd className="mt-1 font-medium">{job.packageCount}</dd></div>
                {job.queueEnteredAt ? <div><dt className="text-muted">Entered queue</dt><dd className="mt-1 font-medium">{formatDate(job.queueEnteredAt)}</dd></div> : null}
              </dl>
              <div className="mt-5 space-y-4 border-t pt-5">
                {manager && job.dependsOn && !job.dependencyClearedAt ? <ClearDesignDependencyForm publicReference={job.publicReference} version={job.version} /> : null}
                {manager && job.currentStatus === "UNDER_REVIEW" ? <ReleaseJobForm publicReference={job.publicReference} version={job.version} /> : null}
                {job.currentStatus === "ACCEPTED" && manager ? <AssignJobForm publicReference={job.publicReference} version={job.version} workers={operationWorkers} /> : null}
                {job.currentStatus === "ACCEPTED" && principal.role === "WORKER" ? <ClaimJobForm publicReference={job.publicReference} version={job.version} /> : null}
                {job.currentStatus === "ACCEPTED" && manager ? <QueueOverrideForm publicReference={job.publicReference} version={job.version} /> : null}
                {activeAssignment && manager && ["QUEUED", "PROCESSING", "PREPARING_FOR_PICKUP"].includes(job.currentStatus) ? <ReassignJobForm publicReference={job.publicReference} version={job.version} workers={operationWorkers} /> : null}
                {job.currentStatus === "QUEUED" && (manager || actorOwnsAssignment) ? <ProductionStatusForm label="Start work" publicReference={job.publicReference} toStatus="PROCESSING" version={job.version} /> : null}
                {job.currentStatus === "PROCESSING" && (manager || actorOwnsAssignment) ? <ProductionStatusForm label="Work finished" publicReference={job.publicReference} toStatus="PREPARING_FOR_PICKUP" version={job.version} /> : null}
                {job.currentStatus === "PREPARING_FOR_PICKUP" && (manager || actorOwnsAssignment) ? <ProductionStatusForm label="Ready for pickup" publicReference={job.publicReference} toStatus="READY_FOR_PICKUP" version={job.version} /> : null}
                {job.currentStatus === "READY_FOR_PICKUP" && manager ? <ReissuePickupForm publicReference={job.publicReference} /> : null}
                {!["PICKED_UP", "CANCELLED", "DECLINED"].includes(job.currentStatus) && (manager || actorOwnsAssignment) ? <PackageCountForm packageCount={job.packageCount} publicReference={job.publicReference} version={job.version} /> : null}
                {job.currentStatus === "READY_FOR_PICKUP" ? <Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" href="/app/staff/pickup">Check customer code</Link> : null}
              </div>
            </Card>

            {job.assignments.length > 0 ? (
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Assignment history</h2>
                <ol className="mt-4 space-y-3">{job.assignments.map((assignment) => <li className="rounded-lg border bg-surface-muted p-3 text-sm" key={assignment.id}><p className="font-semibold">{assignment.worker.user.displayName ?? assignment.worker.user.email ?? "Worker"}</p><p className="mt-1 text-xs text-muted">{assignment.kind === "WORKER_CLAIM" ? "Worker claimed" : "Management assigned"} · {formatDate(assignment.assignedAt)}{assignment.releasedAt ? ` · Released ${formatDate(assignment.releasedAt)}` : " · Current"}</p>{assignment.releaseReason ? <p className="mt-2 text-xs leading-5 text-muted">{assignment.releaseReason}</p> : null}</li>)}</ol>
              </Card>
            ) : null}

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Pricing snapshot</h2>
              {snapshot?.pricing.mode === "FIXED" ? (
                <><p className="mt-3 text-2xl font-semibold">{formatGhanaCediMinor(BigInt(snapshot.pricing.totalMinor))}</p><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">Base</dt><dd>{formatGhanaCediMinor(BigInt(snapshot.pricing.basePriceMinor))}</dd></div>{snapshot.request.priority === "EXPRESS" ? <div className="flex justify-between gap-4"><dt className="text-muted">Express surcharge</dt><dd>{formatGhanaCediMinor(BigInt(snapshot.pricing.expressSurchargeMinor))}</dd></div> : null}</dl><p className="mt-4 text-xs leading-5 text-muted">Authoritative calculation saved at submission. No payment is recorded.</p></>
              ) : snapshot?.pricing.mode === "ON_REQUEST" ? (
                <><p className="mt-3 font-semibold">{publicQuotationStatus === "ISSUED" ? "Awaiting customer decision" : publicQuotationStatus === "ACCEPTED" ? "Price agreed" : publicQuotationStatus === "DECLINED" ? "Quotation declined" : publicQuotationStatus === "EXPIRED" ? "Quotation expired" : "Awaiting costing"}</p><p className="mt-2 text-sm leading-6 text-muted">{canManageQuotations(principal.role) ? "Use the management costing section to prepare and manage versioned quotations." : "Only Owner/Admin can access manual costing amounts and quotation controls."}</p></>
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
