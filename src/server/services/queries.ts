import "server-only";

import { prisma } from "@/server/db/prisma";

import { requireServiceManager } from "./authorization";

export type ServiceListFilter = "ALL" | "ACTIVE" | "INACTIVE";

export async function getServicesPageData(input: {
  query?: string;
  status?: ServiceListFilter;
}) {
  const principal = await requireServiceManager();
  const query = input.query?.trim().slice(0, 160) ?? "";
  const status = input.status ?? "ALL";

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
      ...(query
        ? { name: { contains: query, mode: "insensitive" as const } }
        : {}),
      ...(status === "ACTIVE"
        ? { isActive: true }
        : status === "INACTIVE"
          ? { isActive: false }
          : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      allowPriceNegotiation: true,
      description: true,
      id: true,
      isActive: true,
      name: true,
      onlineSubmissionEnabled: true,
      pricingConfiguration: true,
      quantityConfiguration: true,
      specificationConfiguration: true,
      updatedAt: true,
      version: true,
    },
    }),
  ]);

  return { business, principal, services };
}

export async function getManagedService(serviceId: string) {
  const principal = await requireServiceManager();
  const service = await prisma.service.findFirst({
    where: {
      archivedAt: null,
      businessId: principal.businessId,
      id: serviceId,
    },
    include: {
      images: {
        where: { status: "READY" },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: { altText: true, id: true, isCover: true },
      },
    },
  });

  return { principal, service };
}
