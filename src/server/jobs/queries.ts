import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

import { requireCustomer } from "./authorization";

const submissionServiceSelect = {
  defaultComplexity: true,
  defaultWorkloadClass: true,
  description: true,
  id: true,
  images: {
    where: { status: "READY" as const },
    orderBy: [{ isCover: "desc" as const }, { displayOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: { altText: true, id: true, isCover: true },
  },
  isActive: true,
  name: true,
  onlineSubmissionEnabled: true,
  pricingConfiguration: true,
  quantityConfiguration: true,
  slug: true,
  specificationConfiguration: true,
  version: true,
} satisfies Prisma.ServiceSelect;

export async function getCustomerSubmissionPageData() {
  const principal = await requireCustomer();
  const [business, services] = await Promise.all([
    prisma.business.findFirst({
      where: {
        archivedAt: null,
        id: principal.businessId,
        isActive: true,
      },
      select: { acceptingNewJobs: true },
    }),
    prisma.service.findMany({
      where: {
        archivedAt: null,
        businessId: principal.businessId,
        isActive: true,
        onlineSubmissionEnabled: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: submissionServiceSelect,
    }),
  ]);
  return {
    principal,
    services,
    shopOpen: business?.acceptingNewJobs === true,
  };
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
      id: true,
      packageCount: true,
      submissionSnapshot: true,
      quotations: {
        where: { issuedAt: { not: null }, status: { not: "DRAFT" } },
        orderBy: { quotationVersion: "desc" },
        select: {
          acceptedAt: true,
          counteroffers: {
            orderBy: { createdAt: "desc" },
            select: { amountMinor: true, createdAt: true, status: true },
          },
          declinedAt: true,
          expiresAt: true,
          id: true,
          issuedAt: true,
          negotiationAllowed: true,
          quotationVersion: true,
          rowVersion: true,
          status: true,
          totalMinor: true,
        },
      },
      priority: true,
      publicReference: true,
      service: { select: { name: true } },
      submissionGroupReference: true,
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
      id: true,
      packageCount: true,
      priority: true,
      publicReference: true,
      service: { select: { name: true, slug: true } },
      messages: {
        where: { removedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { body: true, createdAt: true, id: true, senderKind: true },
      },
      submissionGroupReference: true,
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          fromStatus: true,
          id: true,
          toStatus: true,
        },
      },
      submissionSnapshot: true,
      quotations: {
        where: { issuedAt: { not: null }, status: { not: "DRAFT" } },
        orderBy: { quotationVersion: "desc" },
        select: {
          acceptedAt: true,
          counteroffers: {
            orderBy: { createdAt: "desc" },
            select: {
              amountMinor: true,
              createdAt: true,
              customerNote: true,
              id: true,
              respondedAt: true,
              status: true,
            },
          },
          currency: true,
          customerNote: true,
          declinedAt: true,
          expiresAt: true,
          expressSurchargeBasisPoints: true,
          expressSurchargeMinor: true,
          id: true,
          issuedAt: true,
          lineItems: true,
          negotiationAllowed: true,
          publicReference: true,
          quotationVersion: true,
          rowVersion: true,
          status: true,
          subtotalMinor: true,
          totalMinor: true,
          withdrawnAt: true,
        },
      },
      title: true,
    },
  });
  if (job?.service.slug === "website-design-creation") {
    await prisma.jobMessage.updateMany({
      where: {
        businessId: principal.businessId,
        jobId: job.id,
        readByCustomerAt: null,
        removedAt: null,
        senderKind: "STAFF",
      },
      data: { readByCustomerAt: new Date() },
    });
  }
  return { job, principal };
}
