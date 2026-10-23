import "server-only";

import {
  STAFF_JOB_PAGE_SIZE,
  type StaffJobInboxFilters,
} from "@/domain/staff-job-policy";
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
  const where = inboxWhere(principal.businessId, filters);
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
      submissionSnapshot: true,
      title: true,
      updatedAt: true,
    },
  });

  return {
    filters: { ...filters, page },
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
