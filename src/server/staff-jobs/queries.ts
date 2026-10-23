import "server-only";

import {
  STAFF_JOB_PAGE_SIZE,
  type StaffJobInboxFilters,
} from "@/domain/staff-job-policy";
import { canManageQuotations } from "@/domain/quotation-policy";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

import { requireStaffJobAccess } from "./authorization";

function inboxWhere(
  businessId: string,
  filters: StaffJobInboxFilters,
): Prisma.JobWhereInput {
  return {
    archivedAt: null,
    businessId,
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
    ...(filters.status ? { currentStatus: filters.status } : {}),
    ...(filters.pricing
      ? { AND: [pricingWhere(filters.pricing)] }
      : {}),
    ...(filters.query
      ? {
          OR: [
            {
              publicReference: {
                contains: filters.query,
                mode: "insensitive" as const,
              },
            },
            {
              customer: {
                displayName: {
                  contains: filters.query,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              customer: {
                email: {
                  contains: filters.query,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };
}

function pricingWhere(
  pricing: NonNullable<StaffJobInboxFilters["pricing"]>,
): Prisma.JobWhereInput {
  const manual = {
    submissionSnapshot: { path: ["pricing", "mode"], equals: "ON_REQUEST" },
  } satisfies Prisma.JobWhereInput;
  if (pricing === "FIXED_CONFIRMED") {
    return {
      submissionSnapshot: { path: ["pricing", "mode"], equals: "FIXED" },
    };
  }
  if (pricing === "AWAITING_COSTING") {
    return { AND: [manual, { quotations: { none: {} } }] };
  }
  if (pricing === "DRAFT") {
    return { AND: [manual, { quotations: { some: { status: "DRAFT" } } }] };
  }
  if (pricing === "AWAITING_CUSTOMER") {
    return {
      AND: [
        manual,
        {
          quotations: {
            some: {
              counteroffers: { none: { status: "PENDING" } },
              expiresAt: { gt: new Date() },
              status: "ISSUED",
            },
          },
        },
      ],
    };
  }
  if (pricing === "COUNTEROFFER") {
    return {
      AND: [
        manual,
        {
          quotations: {
            some: {
              counteroffers: { some: { status: "PENDING" } },
              status: "ISSUED",
            },
          },
        },
      ],
    };
  }
  if (pricing === "EXPIRED") {
    return {
      AND: [
        manual,
        {
          quotations: {
            some: {
              OR: [
                { status: "EXPIRED" },
                { expiresAt: { lte: new Date() }, status: "ISSUED" },
              ],
            },
          },
        },
      ],
    };
  }
  return {
    AND: [
      manual,
      {
        quotations: {
          some: { status: pricing === "ACCEPTED" ? "ACCEPTED" : "DECLINED" },
        },
      },
    ],
  };
}

function inboxOrderBy(filters: StaffJobInboxFilters): Prisma.JobOrderByWithRelationInput[] {
  if (filters.sort === "OLDEST") {
    return [{ createdAt: "asc" }, { id: "asc" }];
  }
  if (filters.sort === "UPDATED") {
    return [{ updatedAt: "desc" }, { id: "desc" }];
  }
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export async function getStaffJobInbox(filters: StaffJobInboxFilters) {
  const principal = await requireStaffJobAccess();
  const effectiveFilters = canManageQuotations(principal.role)
    ? filters
    : { ...filters, pricing: null };
  const where = inboxWhere(principal.businessId, effectiveFilters);
  const [services, totalJobs] = await Promise.all([
    prisma.service.findMany({
      where: { archivedAt: null, businessId: principal.businessId },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.job.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalJobs / STAFF_JOB_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const jobs = await prisma.job.findMany({
    where,
    orderBy: inboxOrderBy(filters),
    skip: (page - 1) * STAFF_JOB_PAGE_SIZE,
    take: STAFF_JOB_PAGE_SIZE,
    select: {
      createdAt: true,
      currentStatus: true,
      customer: {
        select: { displayName: true, email: true },
      },
      priority: true,
      publicReference: true,
      quantity: true,
      service: { select: { name: true } },
      quotations: {
        where: canManageQuotations(principal.role)
          ? undefined
          : { status: { not: "DRAFT" } },
        orderBy: { quotationVersion: "desc" },
        select: {
          counteroffers: {
            where: { status: "PENDING" },
            select: { id: true },
          },
          expiresAt: true,
          status: true,
        },
      },
      submissionSnapshot: true,
      title: true,
      updatedAt: true,
    },
  });

  return {
    filters: { ...effectiveFilters, page },
    jobs,
    principal,
    services,
    totalJobs,
    totalPages,
  };
}

export async function getStaffJobDetail(publicReference: string) {
  const principal = await requireStaffJobAccess();
  if (!publicReference || publicReference.length > 32) {
    return { job: null, principal };
  }

  const job = await prisma.job.findFirst({
    where: {
      archivedAt: null,
      businessId: principal.businessId,
      publicReference,
    },
    select: {
      attachments: {
        where: { removedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          byteSize: true,
          createdAt: true,
          id: true,
          mimeType: true,
          originalFilename: true,
          purpose: true,
        },
      },
      createdAt: true,
      currentStatus: true,
      customer: {
        select: { displayName: true, email: true, phone: true },
      },
      instructions: true,
      notes: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          author: {
            select: {
              user: { select: { displayName: true, email: true } },
            },
          },
          body: true,
          createdAt: true,
          id: true,
        },
      },
      priority: true,
      publicReference: true,
      quantity: true,
      quotations: {
        where: { status: { not: "DRAFT" } },
        orderBy: { quotationVersion: "desc" },
        select: { expiresAt: true, status: true },
      },
      reviewedAt: true,
      service: { select: { id: true, name: true } },
      source: true,
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: {
          actorUser: { select: { displayName: true, email: true } },
          createdAt: true,
          fromStatus: true,
          id: true,
          reason: true,
          toStatus: true,
        },
      },
      submissionSnapshot: true,
      title: true,
      updatedAt: true,
      version: true,
    },
  });

  return { job, principal };
}
