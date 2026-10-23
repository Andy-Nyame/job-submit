import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { CustomerCounterofferForm, CustomerQuotationDecisionForm } from "@/components/quotations/customer-quotation-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isJobSubmissionSnapshot } from "@/domain/job-submission";
import { effectiveQuotationStatus, expressSurchargeLabel, readQuotationLineItems } from "@/domain/quotation-policy";
import { formatGhanaCediMinor } from "@/domain/service-pricing";
import { getCustomerJob } from "@/server/jobs/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Job details" };

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

interface CustomerJobPageProps {
  params: Promise<{ publicReference: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export default async function CustomerJobPage({ params, searchParams }: CustomerJobPageProps) {
  const [{ publicReference }, query] = await Promise.all([params, searchParams]);
  const { job } = await getCustomerJob(publicReference);
  if (!job) {
    notFound();
  }
  const snapshot = isJobSubmissionSnapshot(job.submissionSnapshot) ? job.submissionSnapshot : null;
  const quotation = job.quotations[0] ?? null;
  const quotationStatus = quotation
    ? effectiveQuotationStatus(quotation.status, quotation.expiresAt)
    : null;
  const quoteItems = quotation ? readQuotationLineItems(quotation.lineItems) : [];
  const pendingCounteroffer = quotation?.counteroffers.find((offer) => offer.status === "PENDING") ?? null;

  return (
    <main className="py-10 sm:py-14" id="main-content">
      <Container className="max-w-5xl">
        {query.submitted === "1" ? (
          <div className="mb-6 rounded-xl border border-success/45 bg-success/10 p-5" role="status">
            <p className="font-semibold">Your job request was received.</p>
            <p className="mt-2 text-sm leading-6 text-muted">Keep the reference below. The team can now review the submitted details; no payment or completion date has been recorded.</p>
          </div>
        ) : null}
        <Link className="text-sm font-medium text-muted underline decoration-accent underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/app/jobs">Back to my jobs</Link>
        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted">{job.publicReference}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{job.title}</h1><p className="mt-2 text-sm text-muted">{job.service.name} · Submitted {formatDate(job.createdAt)}</p></div>
          <div className="flex gap-2"><Badge>{formatStatus(job.currentStatus)}</Badge><Badge>{job.priority === "EXPRESS" ? "Express" : "Regular"}</Badge></div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <Card className="p-5 sm:p-7">
            <h2 className="text-xl font-semibold">Submitted details</h2>
            {snapshot ? (
              <div className="mt-5 space-y-6 text-sm">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-muted">Quantity</dt><dd className="mt-1 font-medium">{snapshot.request.quantity?.toLocaleString("en-US") ?? "Not applicable"}</dd></div>
                  <div><dt className="text-muted">Size</dt><dd className="mt-1 font-medium">{snapshot.request.size.kind === "NONE" ? "Not applicable" : snapshot.request.size.kind === "PRESET" ? snapshot.request.size.option : `${snapshot.request.size.width} × ${snapshot.request.size.height} ${snapshot.request.size.unit.toLowerCase()}`}</dd></div>
                  {snapshot.request.material ? <div><dt className="text-muted">Material</dt><dd className="mt-1 font-medium">{snapshot.request.material}</dd></div> : null}
                  {snapshot.request.finishing ? <div><dt className="text-muted">Finishing</dt><dd className="mt-1 font-medium">{snapshot.request.finishing}</dd></div> : null}
                </dl>
                <div><h3 className="font-medium text-muted">Instructions</h3><p className="mt-2 whitespace-pre-wrap leading-6">{snapshot.request.instructions || "No additional instructions."}</p></div>
                {Object.keys(snapshot.request.jobFields).length > 0 ? <div><h3 className="font-medium text-muted">Service information</h3><dl className="mt-2 grid gap-3 sm:grid-cols-2">{Object.entries(snapshot.request.jobFields).map(([key, value]) => <div key={key}><dt className="font-mono text-xs text-muted">{key}</dt><dd className="mt-1 whitespace-pre-wrap">{value}</dd></div>)}</dl></div> : null}
                {snapshot.request.variations.length > 0 ? <div><h3 className="font-medium text-muted">Variations</h3><ol className="mt-2 space-y-3">{snapshot.request.variations.map((variation, index) => <li className="rounded-lg border bg-surface-muted p-4" key={variation.id}><p className="font-medium">Variation {index + 1}: {variation.quantity.toLocaleString("en-US")}</p>{Object.entries(variation.fieldValues).map(([key, value]) => <p className="mt-1 text-muted" key={key}>{key}: <span className="text-foreground">{value}</span></p>)}</li>)}</ol></div> : null}
              </div>
            ) : <p className="mt-4 text-sm text-muted">This legacy job does not contain a Brick 6A submission snapshot.</p>}
          </Card>

          <aside className="space-y-6">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Pricing</h2>
              {snapshot?.pricing.mode === "FIXED" ? (
                <><p className="mt-3 text-xl font-semibold">{formatGhanaCediMinor(BigInt(snapshot.pricing.totalMinor))}</p><Badge className="mt-3">Price confirmed</Badge><p className="mt-3 text-sm leading-6 text-muted">This authoritative price was calculated and saved at submission. Operational review is separate, production has not automatically started, and no payment is recorded.</p></>
              ) : quotation && quotationStatus ? (
                <div className="mt-4 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">{quotation.publicReference} · Version {quotation.quotationVersion}</p><p className="mt-2 text-2xl font-semibold">{formatGhanaCediMinor(quotation.totalMinor)}</p></div><Badge>{quotationStatus === "ISSUED" ? "Decision required" : quotationStatus === "ACCEPTED" ? "Price agreed" : formatStatus(quotationStatus)}</Badge></div>
                  <dl className="space-y-2 border-t pt-4 text-sm">
                    {quoteItems.map((item, index) => <div className="flex justify-between gap-4" key={`${item.description}-${index}`}><dt className="text-muted">{item.description}{item.kind === "ADDITIONAL" ? " · Additional" : ""}</dt><dd className="font-medium">{formatGhanaCediMinor(BigInt(item.amountMinor))}</dd></div>)}
                    <div className="flex justify-between gap-4 border-t pt-2"><dt className="text-muted">Subtotal</dt><dd className="font-medium">{formatGhanaCediMinor(quotation.subtotalMinor)}</dd></div>
                    {quotation.expressSurchargeMinor > 0n ? <div className="flex justify-between gap-4"><dt className="text-muted">{expressSurchargeLabel(quotation.expressSurchargeBasisPoints)}</dt><dd className="font-medium">{formatGhanaCediMinor(quotation.expressSurchargeMinor)}</dd></div> : null}
                    <div className="flex justify-between gap-4 text-base"><dt className="font-semibold">Final total</dt><dd className="font-semibold">{formatGhanaCediMinor(quotation.totalMinor)}</dd></div>
                  </dl>
                  <p className="text-xs leading-5 text-muted">{quotationStatus === "EXPIRED" ? "This quotation has expired and cannot be accepted." : `Valid until ${formatDate(quotation.expiresAt)}.`} No payment is recorded and acceptance does not start production automatically.</p>
                  {quotation.customerNote ? <div className="rounded-lg border bg-surface-muted p-3 text-sm leading-6"><p className="font-medium">Management note</p><p className="mt-1 whitespace-pre-wrap text-muted">{quotation.customerNote}</p></div> : null}
                  {pendingCounteroffer ? <div className="rounded-lg border border-accent/45 bg-accent/10 p-4"><p className="font-semibold">Counteroffer awaiting management</p><p className="mt-1 text-sm text-muted">Proposed amount: {formatGhanaCediMinor(pendingCounteroffer.amountMinor)}. This is not an approved price.</p></div> : null}
                  {quotationStatus === "ISSUED" && !pendingCounteroffer ? <CustomerQuotationDecisionForm publicReference={job.publicReference} quotationId={quotation.id} rowVersion={quotation.rowVersion} /> : null}
                  {quotationStatus === "ISSUED" && quotation.negotiationAllowed && !pendingCounteroffer ? <CustomerCounterofferForm publicReference={job.publicReference} quotationId={quotation.id} rowVersion={quotation.rowVersion} /> : null}
                  {quotationStatus === "ISSUED" && !quotation.negotiationAllowed ? <p className="rounded-lg border bg-surface-muted p-3 text-xs leading-5 text-muted">Price negotiation is not enabled for this quotation. You may accept or decline the quoted amount.</p> : null}
                </div>
              ) : (
                <><p className="mt-3 font-semibold">Quotation pending</p><Badge className="mt-3">Awaiting costing</Badge><p className="mt-3 text-sm leading-6 text-muted">Authorized management will review the submitted requirements and issue a quotation. This is not a GH₵0 quotation.</p></>
              )}
            </Card>
            <Card className="p-5 sm:p-6"><h2 className="text-lg font-semibold">Status updates</h2>{job.statusHistory.length > 0 ? <ol className="mt-4 space-y-3 border-l border-border-strong pl-4">{job.statusHistory.map((entry) => <li key={entry.id}><p className="text-sm font-medium">{entry.fromStatus ? `${formatStatus(entry.fromStatus)} → ` : ""}{formatStatus(entry.toStatus)}</p><p className="mt-1 text-xs text-muted">{formatDate(entry.createdAt)}</p></li>)}</ol> : <p className="mt-3 text-sm text-muted">No status updates are available.</p>}</Card>
            <Card className="p-5 sm:p-6"><h2 className="text-lg font-semibold">Reference files</h2>{job.attachments.length > 0 ? <ul className="mt-3 space-y-3">{job.attachments.map((attachment) => <li key={attachment.id}><Link className="block rounded-md border p-3 text-sm outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" href={`/api/jobs/${encodeURIComponent(job.publicReference)}/attachments/${attachment.id}`}><span className="block truncate font-medium">{attachment.originalFilename}</span><span className="mt-1 block text-xs text-muted">{formatBytes(attachment.byteSize)} · Private download</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-muted">No files were attached.</p>}</Card>
            <Card className="p-5 sm:p-6"><h2 className="text-lg font-semibold">What happens next</h2><p className="mt-2 text-sm leading-6 text-muted">The job remains in operational staff review. A fixed price or accepted quotation records the agreed price only; production and payment do not start automatically. Messages, external notifications, payment, and pickup verification remain future milestones.</p></Card>
          </aside>
        </div>
      </Container>
    </main>
  );
}
