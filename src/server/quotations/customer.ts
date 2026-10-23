import "server-only";

import {
  effectiveQuotationStatus,
  QUOTATION_AUDIT_ACTIONS,
  QuotationPolicyError,
  validateCounteroffer,
} from "@/domain/quotation-policy";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

import { QuotationOperationError } from "./errors";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

async function ensureActiveCustomer(
  transaction: Prisma.TransactionClient,
  actor: ApplicationPrincipal,
) {
  const membership = await transaction.businessMembership.findFirst({
    where: {
      business: { archivedAt: null, isActive: true },
      businessId: actor.businessId,
      deactivatedAt: null,
      id: actor.membershipId,
      role: "CUSTOMER",
      status: "ACTIVE",
      user: { deactivatedAt: null, id: actor.userId },
    },
    select: { id: true },
  });
  if (!membership) throw new QuotationOperationError("BUSINESS_UNAVAILABLE");
}

async function withCustomerTransaction<T>(
  actor: ApplicationPrincipal,
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  if (actor.role !== "CUSTOMER") {
    throw new QuotationOperationError("BUSINESS_UNAVAILABLE");
  }
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          await ensureActiveCustomer(transaction, actor);
          return work(transaction);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        if (isRetryable(error)) {
          throw new QuotationOperationError("STALE_UPDATE");
        }
        throw error;
      }
    }
  }
  throw new QuotationOperationError("STALE_UPDATE");
}

async function expireQuotation(
  transaction: Prisma.TransactionClient,
  actor: ApplicationPrincipal,
  quotation: { id: string; rowVersion: number },
) {
  const now = new Date();
  await transaction.quotationCounteroffer.updateMany({
    where: {
      businessId: actor.businessId,
      quotationId: quotation.id,
      status: "PENDING",
    },
    data: { respondedAt: now, status: "SUPERSEDED" },
  });
  const expired = await transaction.jobQuotation.updateMany({
    where: {
      businessId: actor.businessId,
      id: quotation.id,
      rowVersion: quotation.rowVersion,
      status: "ISSUED",
    },
    data: { rowVersion: { increment: 1 }, status: "EXPIRED" },
  });
  if (expired.count !== 1) {
    throw new QuotationOperationError("STALE_UPDATE");
  }
  await transaction.auditLog.create({
    data: {
      action: QUOTATION_AUDIT_ACTIONS.EXPIRED,
      actorMembershipId: actor.membershipId,
      actorUserId: actor.userId,
      businessId: actor.businessId,
      targetId: quotation.id,
      targetType: "JobQuotation",
    },
  });
}

export async function decideCustomerQuotation(
  actor: ApplicationPrincipal,
  input: {
    decision: "ACCEPT" | "DECLINE";
    expectedVersion: number;
    quotationId: string;
  },
) {
  const result = await withCustomerTransaction(actor, async (transaction) => {
    const quotation = await transaction.jobQuotation.findFirst({
      where: {
        businessId: actor.businessId,
        id: input.quotationId,
        job: { archivedAt: null, customer: { userId: actor.userId } },
      },
      select: {
        decidedByUserId: true,
        expiresAt: true,
        id: true,
        jobId: true,
        rowVersion: true,
        status: true,
      },
    });
    if (!quotation) throw new QuotationOperationError("NOT_FOUND");
    const target = input.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    if (quotation.status === target && quotation.decidedByUserId === actor.userId) {
      return { expired: false, idempotent: true };
    }
    if (
      quotation.status !== "ISSUED" ||
      quotation.rowVersion !== input.expectedVersion
    ) {
      throw new QuotationOperationError("STALE_UPDATE");
    }
    if (
      effectiveQuotationStatus(quotation.status, quotation.expiresAt) ===
      "EXPIRED"
    ) {
      await expireQuotation(transaction, actor, quotation);
      return { expired: true, idempotent: false };
    }
    const pending = await transaction.quotationCounteroffer.findFirst({
      where: {
        businessId: actor.businessId,
        quotationId: quotation.id,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (pending) throw new QuotationOperationError("INVALID_TRANSITION");

    const now = new Date();
    const updated = await transaction.jobQuotation.updateMany({
      where: {
        businessId: actor.businessId,
        id: quotation.id,
        rowVersion: input.expectedVersion,
        status: "ISSUED",
      },
      data:
        input.decision === "ACCEPT"
          ? {
              acceptedAt: now,
              decidedByUserId: actor.userId,
              rowVersion: { increment: 1 },
              status: "ACCEPTED",
            }
          : {
              decidedByUserId: actor.userId,
              declinedAt: now,
              rowVersion: { increment: 1 },
              status: "DECLINED",
            },
    });
    if (updated.count !== 1) throw new QuotationOperationError("STALE_UPDATE");
    await transaction.auditLog.create({
      data: {
        action:
          input.decision === "ACCEPT"
            ? QUOTATION_AUDIT_ACTIONS.CUSTOMER_ACCEPTED
            : QUOTATION_AUDIT_ACTIONS.CUSTOMER_DECLINED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { jobId: quotation.jobId },
        targetId: quotation.id,
        targetType: "JobQuotation",
      },
    });
    return { expired: false, idempotent: false };
  });
  if (result.expired) throw new QuotationOperationError("EXPIRED");
  return result;
}

export async function submitCustomerCounteroffer(
  actor: ApplicationPrincipal,
  input: {
    amount: string;
    expectedVersion: number;
    note: string;
    quotationId: string;
  },
) {
  let proposal: ReturnType<typeof validateCounteroffer>;
  try {
    proposal = validateCounteroffer(input.amount, input.note);
  } catch (error) {
    if (error instanceof QuotationPolicyError) {
      throw new QuotationOperationError("INVALID_INPUT");
    }
    throw error;
  }
  const result = await withCustomerTransaction(actor, async (transaction) => {
    const quotation = await transaction.jobQuotation.findFirst({
      where: {
        businessId: actor.businessId,
        id: input.quotationId,
        job: { archivedAt: null, customer: { userId: actor.userId } },
      },
      select: {
        expiresAt: true,
        id: true,
        jobId: true,
        negotiationAllowed: true,
        rowVersion: true,
        status: true,
      },
    });
    if (!quotation) throw new QuotationOperationError("NOT_FOUND");
    if (!quotation.negotiationAllowed) {
      throw new QuotationOperationError("COUNTEROFFER_NOT_ALLOWED");
    }
    if (
      quotation.status !== "ISSUED" ||
      quotation.rowVersion !== input.expectedVersion
    ) {
      throw new QuotationOperationError("STALE_UPDATE");
    }
    if (
      effectiveQuotationStatus(quotation.status, quotation.expiresAt) ===
      "EXPIRED"
    ) {
      await expireQuotation(transaction, actor, quotation);
      return { expired: true, id: "" };
    }
    const pending = await transaction.quotationCounteroffer.findFirst({
      where: {
        businessId: actor.businessId,
        quotationId: quotation.id,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (pending) throw new QuotationOperationError("DUPLICATE_OPERATION");

    const versionUpdate = await transaction.jobQuotation.updateMany({
      where: {
        businessId: actor.businessId,
        id: quotation.id,
        rowVersion: input.expectedVersion,
        status: "ISSUED",
      },
      data: { rowVersion: { increment: 1 } },
    });
    if (versionUpdate.count !== 1) {
      throw new QuotationOperationError("STALE_UPDATE");
    }
    const counteroffer = await transaction.quotationCounteroffer.create({
      data: {
        amountMinor: proposal.amountMinor,
        businessId: actor.businessId,
        customerNote: proposal.customerNote,
        quotationId: quotation.id,
        submittedByUserId: actor.userId,
      },
    });
    await transaction.auditLog.create({
      data: {
        action: QUOTATION_AUDIT_ACTIONS.COUNTEROFFER_SUBMITTED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { counterofferId: counteroffer.id, jobId: quotation.jobId },
        targetId: quotation.id,
        targetType: "JobQuotation",
      },
    });
    return { expired: false, id: counteroffer.id };
  });
  if (result.expired) throw new QuotationOperationError("EXPIRED");
  return result;
}
