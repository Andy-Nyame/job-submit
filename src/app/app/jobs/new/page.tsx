import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";

import { CustomerJobSubmissionForm } from "@/components/jobs/customer-job-submission-form";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { getCustomerSubmissionPageData } from "@/server/jobs/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Submit a job" };

interface NewJobPageProps {
  searchParams: Promise<{ service?: string }>;
}

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  const [{ service: initialServiceSlug }, data] = await Promise.all([
    searchParams,
    getCustomerSubmissionPageData(),
  ]);

  return (
    <main className="py-10 sm:py-14" id="main-content">
      <Container className="max-w-5xl">
        <header className="max-w-3xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Customer request
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Submit a job
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Choose what you need, tell us the details, then check and send your job.
          </p>
        </header>

        <div className="mt-8">
          {!data.shopOpen ? (
            <Card className="p-6 sm:p-8" role="status">
              <h2 className="text-xl font-semibold">
                We&apos;re not taking new jobs right now
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                Please check back later. You can still view your existing jobs,
                prices, notifications, and account.
              </p>
              <Link
                className="mt-6 inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                href="/app/jobs"
              >
                View My Jobs
              </Link>
            </Card>
          ) : data.services.length > 0 ? (
            <CustomerJobSubmissionForm
              customerEmail={data.principal.email}
              customerName={data.principal.displayName}
              idempotencyKey={randomUUID()}
              initialServiceSlug={initialServiceSlug}
              services={data.services}
            />
          ) : (
            <Card className="p-6 sm:p-8" role="status">
              <h2 className="text-xl font-semibold">
                No services are ready for online requests
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                The shop is open, but no active service is enabled for online
                submission right now. Please check back later.
              </p>
              <Link
                className="mt-6 inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                href="/#services"
              >
                View services
              </Link>
            </Card>
          )}
        </div>
      </Container>
    </main>
  );
}
