import "server-only";

import { prisma } from "@/server/db/prisma";

import { requireQuotationManager } from "./authorization";

export async function getManagementQuotationData(publicReference: string) {
  const principal = await requireQuotationManager();
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
      id: true,
      priority: true,
      publicReference: true,
      service: {
        select: {
          allowPriceNegotiation: true,
          name: true,
        },
      },
      submissionSnapshot: true,
      quotations: {
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
          createdAt: true,
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
          supersededAt: true,
          totalMinor: true,
          validityDays: true,
          withdrawalReason: true,
          withdrawnAt: true,
        },
      },
    },
  });
  return { job, principal };
}
