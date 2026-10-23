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
            Choose a configured service, provide the relevant production details,
            and review everything before sending it to Capt. Bob Cedi&apos;s Artworks.
          </p>
        </header>

        <div className="mt-8">
          {data.services.length > 0 ? (
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
                Online service requests are not open yet
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                No active service is currently enabled for online submission.
                The public service catalogue remains available, and this page
                will open automatically when the business enables a service.
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
