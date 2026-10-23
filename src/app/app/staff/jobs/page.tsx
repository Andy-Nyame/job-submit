import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { isJobSubmissionSnapshot } from "@/domain/job-submission";
import {
  canManageStaffJobs,
  parseStaffJobInboxFilters,
  STAFF_JOB_STATUSES,
  StaffJobPolicyError,
  type StaffJobInboxFilters,
} from "@/domain/staff-job-policy";
import { formatGhanaCediMinor } from "@/domain/service-pricing";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { getStaffJobInbox } from "@/server/staff-jobs/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff job inbox" };

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./u, (character) => character.toUpperCase());
}

function pricingLabel(snapshotValue: unknown) {
  if (!isJobSubmissionSnapshot(snapshotValue)) {
    return "Pricing unavailable";
  }
  return snapshotValue.pricing.mode === "FIXED"
    ? formatGhanaCediMinor(BigInt(snapshotValue.pricing.totalMinor))
    : "Quotation pending";
}

function customerLabel(customer: {
  displayName: string | null;
  email: string | null;
} | null) {
  return customer?.displayName ?? customer?.email ?? "Customer details unavailable";
}

function inboxHref(
  filters: StaffJobInboxFilters,
  overrides: Partial<StaffJobInboxFilters>,
) {
  const next = { ...filters, ...overrides };
  const query = new URLSearchParams();
  if (next.query) query.set("q", next.query);
  if (next.status) query.set("status", next.status);
  if (next.serviceId) query.set("service", next.serviceId);
  if (next.priority) query.set("priority", next.priority);
  if (next.sort !== "NEWEST") query.set("sort", next.sort);
  if (next.page > 1) query.set("page", String(next.page));
  const value = query.toString();
  return value ? `/app/staff/jobs?${value}` : "/app/staff/jobs";
}

interface StaffJobsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StaffJobsPage({ searchParams }: StaffJobsPageProps) {
  const principal = await requireBusinessMembership();
  if (!canManageStaffJobs(principal.role)) {
    redirect("/app");
  }

  const rawFilters = await searchParams;
  let filterError = false;
  let filters: StaffJobInboxFilters;
  try {
    filters = parseStaffJobInboxFilters(rawFilters);
  } catch (error) {
    if (!(error instanceof StaffJobPolicyError)) throw error;
    filters = parseStaffJobInboxFilters({});
    filterError = true;
  }
  const data = await getStaffJobInbox(filters);

  return (
    <main className="py-10 sm:py-14" id="main-content">
      <Container>
        <header className="max-w-3xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Staff operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Job inbox</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Review customer submissions for this business. Express work and quotation requests are clearly marked; later production stages remain outside this milestone.
          </p>
        </header>

        {filterError ? (
          <div className="mt-6 rounded-xl border border-destructive/45 bg-destructive-surface p-4 text-sm" role="alert">
            The requested filters were invalid and were safely reset. Use the controls below to try again.
          </div>
        ) : null}

        <section aria-labelledby="inbox-heading" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold" id="inbox-heading">Submitted jobs</h2>
              <p className="mt-1 text-sm text-muted">{data.totalJobs.toLocaleString("en-US")} matching job{data.totalJobs === 1 ? "" : "s"}</p>
            </div>
          </div>

          <form className="mt-5 grid gap-3 rounded-2xl border bg-surface p-4 shadow-[0_16px_44px_-38px_var(--shadow-color)] sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.4fr)_repeat(4,minmax(9rem,1fr))_auto]">
            <div>
              <label className="sr-only" htmlFor="job-search">Search reference or customer</label>
              <Input defaultValue={data.filters.query} id="job-search" maxLength={100} name="q" placeholder="Reference or customer" type="search" />
            </div>
            <div>
              <label className="sr-only" htmlFor="job-status">Filter by status</label>
              <Select defaultValue={data.filters.status ?? "ALL"} id="job-status" name="status">
                <option value="ALL">All statuses</option>
                {STAFF_JOB_STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
              </Select>
            </div>
            <div>
              <label className="sr-only" htmlFor="job-service">Filter by service</label>
              <Select defaultValue={data.filters.serviceId ?? "ALL"} id="job-service" name="service">
                <option value="ALL">All services</option>
                {data.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="sr-only" htmlFor="job-priority">Filter by priority</label>
              <Select defaultValue={data.filters.priority ?? "ALL"} id="job-priority" name="priority">
                <option value="ALL">All priorities</option>
                <option value="REGULAR">Regular</option>
                <option value="EXPRESS">Express / Urgent</option>
              </Select>
            </div>
            <div>
              <label className="sr-only" htmlFor="job-sort">Sort jobs</label>
              <Select defaultValue={data.filters.sort} id="job-sort" name="sort">
                <option value="NEWEST">Newest submitted</option>
                <option value="OLDEST">Oldest submitted</option>
                <option value="UPDATED">Recently updated</option>
              </Select>
            </div>
            <button className="min-h-11 rounded-lg border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:border-primary-hover hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" type="submit">
              Apply
            </button>
          </form>

          {data.jobs.length === 0 ? (
            <Card className="mt-5">
              <h3 className="font-semibold">No matching jobs</h3>
              <p className="mt-2 text-sm leading-6 text-muted">No jobs in this business match the current search and filters.</p>
            </Card>
          ) : (
            <div className="mt-5 grid gap-4">
              {data.jobs.map((job) => {
                const price = pricingLabel(job.submissionSnapshot);
                return (
                  <article className="rounded-2xl border bg-surface p-5 shadow-[0_16px_44px_-38px_var(--shadow-color)] sm:p-6" key={job.publicReference}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">{job.publicReference}</p>
                        <h3 className="mt-2 text-lg font-semibold">{job.title}</h3>
                        <p className="mt-1 text-sm text-muted">{customerLabel(job.customer)} · {job.service.name}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{formatStatus(job.currentStatus)}</Badge>
                        <Badge className={job.priority === "EXPRESS" ? "border-destructive/45 bg-destructive-surface text-destructive" : undefined}>{job.priority === "EXPRESS" ? "Express / Urgent" : "Regular"}</Badge>
                        {price === "Quotation pending" ? <Badge>Quotation pending</Badge> : null}
                      </div>
                    </div>
                    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-muted">Submitted</dt><dd className="mt-1 font-medium">{formatDate(job.createdAt)}</dd></div>
                      <div><dt className="text-muted">Quantity</dt><dd className="mt-1 font-medium">{job.quantity?.toLocaleString("en-US") ?? "Not applicable"}</dd></div>
                      <div><dt className="text-muted">Pricing</dt><dd className="mt-1 font-medium">{price}</dd></div>
                      <div><dt className="text-muted">Updated</dt><dd className="mt-1 font-medium">{formatDate(job.updatedAt)}</dd></div>
                    </dl>
                    <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-border-strong px-4 text-sm font-semibold outline-none transition-colors hover:border-primary/45 hover:bg-primary-surface hover:text-primary-surface-foreground focus-visible:ring-2 focus-visible:ring-ring" href={`/app/staff/jobs/${encodeURIComponent(job.publicReference)}`}>
                      Review job
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          {data.totalPages > 1 ? (
            <nav aria-label="Job inbox pagination" className="mt-6 flex items-center justify-between gap-4">
              {data.filters.page > 1 ? <Link className="rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold outline-none hover:bg-primary-surface focus-visible:ring-2 focus-visible:ring-ring" href={inboxHref(data.filters, { page: data.filters.page - 1 })}>Previous</Link> : <span />}
              <p className="text-sm text-muted">Page {data.filters.page} of {data.totalPages}</p>
              {data.filters.page < data.totalPages ? <Link className="rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold outline-none hover:bg-primary-surface focus-visible:ring-2 focus-visible:ring-ring" href={inboxHref(data.filters, { page: data.filters.page + 1 })}>Next</Link> : <span />}
            </nav>
          ) : null}
        </section>
      </Container>
    </main>
  );
}
