import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintJobLabelButton } from "@/components/staff-jobs/print-job-label-button";
import { isJobSubmissionSnapshot } from "@/domain/job-submission";
import { qrDataUrl, staffJobUrl } from "@/server/job-operations/qr-codes";
import { getStaffJobDetail } from "@/server/staff-jobs/queries";

export const dynamic = "force-dynamic";

function usefulSpecification(snapshot: unknown) {
  if (!isJobSubmissionSnapshot(snapshot)) return null;
  const details = [snapshot.request.material, snapshot.request.finishing].filter(Boolean);
  if (snapshot.request.size.kind === "PRESET") details.unshift(snapshot.request.size.option);
  if (snapshot.request.size.kind === "CUSTOM" || snapshot.request.size.kind === "FIXED") {
    details.unshift(`${snapshot.request.size.width} × ${snapshot.request.size.height} ${snapshot.request.size.unit.toLowerCase()}`);
  }
  return details.join(" · ") || null;
}

export default async function JobLabelPage({ params }: { params: Promise<{ publicReference: string }> }) {
  const { publicReference } = await params;
  const { job } = await getStaffJobDetail(publicReference);
  if (!job) notFound();
  const qr = await qrDataUrl(staffJobUrl(job.publicReference));
  const specification = usefulSpecification(job.submissionSnapshot);

  return (
    <main className="mx-auto max-w-4xl p-5 sm:p-8" id="main-content">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link className="text-sm font-semibold text-primary underline underline-offset-4" href={`/app/staff/jobs/${encodeURIComponent(job.publicReference)}`}>Back to job</Link>
        <PrintJobLabelButton />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        {Array.from({ length: job.packageCount }, (_, index) => (
          <article className="break-inside-avoid rounded-xl border-2 border-foreground bg-white p-5 text-black" key={index}>
            <p className="text-sm font-bold uppercase tracking-[0.12em]">Capt. Bob Cedi&apos;s Artworks</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em]">Job number</p>
            <h1 className="mt-1 break-all font-mono text-3xl font-black tracking-tight">{job.publicReference}</h1>
            <div className="mt-4 grid grid-cols-[1fr_7rem] gap-4">
              <dl className="space-y-3 text-sm">
                <div><dt className="font-bold">Service</dt><dd>{job.service.name}</dd></div>
                <div><dt className="font-bold">Quantity</dt><dd>{job.quantity?.toLocaleString("en-US") ?? "Not applicable"}</dd></div>
                {specification ? <div><dt className="font-bold">Specification</dt><dd>{specification}</dd></div> : null}
                <div><dt className="font-bold">Priority</dt><dd>{job.priority === "EXPRESS" ? "EXPRESS / URGENT" : "REGULAR"}</dd></div>
                <div><dt className="font-bold">Package</dt><dd className="text-lg font-black">{index + 1} of {job.packageCount}</dd></div>
              </dl>
              <div>
                <Image alt={`QR code for staff job ${job.publicReference}`} height={112} priority src={qr} unoptimized width={112} />
                <p className="mt-1 text-center text-[0.6rem] leading-3">Authorized staff scan</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
