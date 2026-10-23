import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCustomerJobs } from "@/server/jobs/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My jobs" };

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

export default async function CustomerJobsPage() {
  const { jobs } = await getCustomerJobs();
  return (
    <main className="py-10 sm:py-14" id="main-content">
      <Container className="max-w-5xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">Customer workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">My jobs</h1>
            <p className="mt-3 text-sm leading-6 text-muted">Requests submitted from your account. Production tracking and job messaging will expand in later bricks.</p>
          </div>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/app/jobs/new">Submit a job</Link>
        </header>

        {jobs.length === 0 ? (
          <Card className="mt-8 p-6 sm:p-8">
            <h2 className="text-lg font-semibold">No submitted jobs yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted">When an online-enabled service is available, your submitted requests will appear here.</p>
          </Card>
        ) : (
          <div className="mt-8 grid gap-4">
            {jobs.map((job) => (
              <Link className="rounded-xl border bg-surface p-5 outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring sm:p-6" href={`/app/jobs/${encodeURIComponent(job.publicReference)}`} key={job.publicReference}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">{job.publicReference}</p><h2 className="mt-2 text-lg font-semibold">{job.title}</h2><p className="mt-2 text-sm text-muted">{job.service.name} · {formatDate(job.createdAt)}</p></div>
                  <div className="flex flex-wrap gap-2"><Badge>{formatStatus(job.currentStatus)}</Badge><Badge>{job.priority === "EXPRESS" ? "Express" : "Regular"}</Badge></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
