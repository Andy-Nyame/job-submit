import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isJobSubmissionSnapshot } from "@/domain/job-submission";
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
            <Card className="p-5 sm:p-6"><h2 className="text-lg font-semibold">Pricing</h2>{snapshot?.pricing.mode === "FIXED" ? <><p className="mt-3 text-xl font-semibold">{formatGhanaCediMinor(BigInt(snapshot.pricing.totalMinor))}</p><p className="mt-2 text-sm leading-6 text-muted">Calculated from the service configuration at submission. No payment is recorded.</p></> : <><p className="mt-3 font-semibold">Quotation pending</p><p className="mt-2 text-sm leading-6 text-muted">Pricing will be confirmed after the team reviews the request. This is not a GH₵0 quotation.</p></>}</Card>
            <Card className="p-5 sm:p-6"><h2 className="text-lg font-semibold">Reference files</h2>{job.attachments.length > 0 ? <ul className="mt-3 space-y-3">{job.attachments.map((attachment) => <li key={attachment.id}><Link className="block rounded-md border p-3 text-sm outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" href={`/api/jobs/${encodeURIComponent(job.publicReference)}/attachments/${attachment.id}`}><span className="block truncate font-medium">{attachment.originalFilename}</span><span className="mt-1 block text-xs text-muted">{formatBytes(attachment.byteSize)} · Private download</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-muted">No files were attached.</p>}</Card>
            <Card className="p-5 sm:p-6"><h2 className="text-lg font-semibold">What happens next</h2><p className="mt-2 text-sm leading-6 text-muted">The job is submitted for staff review. Quotation acceptance, detailed production tracking, messages, notifications, and pickup verification are not part of Brick 6A.</p></Card>
          </aside>
        </div>
      </Container>
    </main>
  );
}
