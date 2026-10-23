import "server-only";

import { prisma } from "@/server/db/prisma";

import { requireCustomer } from "./authorization";

const submissionServiceSelect = {
  defaultComplexity: true,
  defaultWorkloadClass: true,
  description: true,
  id: true,
  isActive: true,
  name: true,
  onlineSubmissionEnabled: true,
  pricingConfiguration: true,
  quantityConfiguration: true,
  slug: true,
  specificationConfiguration: true,
  version: true,
} as const;

export async function getCustomerSubmissionPageData() {
  const principal = await requireCustomer();
  const services = await prisma.service.findMany({
    where: {
      archivedAt: null,
      businessId: principal.businessId,
      isActive: true,
      onlineSubmissionEnabled: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: submissionServiceSelect,
  });
  return { principal, services };
}

export async function getCustomerJobs() {
  const principal = await requireCustomer();
  const jobs = await prisma.job.findMany({
    where: {
      archivedAt: null,
      businessId: principal.businessId,
      customer: { userId: principal.userId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      currentStatus: true,
      priority: true,
      publicReference: true,
      service: { select: { name: true } },
      title: true,
    },
  });
  return { jobs, principal };
}

export async function getCustomerJob(publicReference: string) {
  const principal = await requireCustomer();
  const job = await prisma.job.findFirst({
    where: {
      archivedAt: null,
      businessId: principal.businessId,
      customer: { userId: principal.userId },
      publicReference,
    },
    select: {
      attachments: {
        where: { removedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          byteSize: true,
          id: true,
          mimeType: true,
          originalFilename: true,
        },
      },
      createdAt: true,
      currentStatus: true,
      priority: true,
      publicReference: true,
      service: { select: { name: true } },
      submissionSnapshot: true,
      title: true,
    },
  });
  return { job, principal };
}
