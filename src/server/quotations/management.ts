import "server-only";

import { randomBytes } from "node:crypto";

import { isJobSubmissionSnapshot } from "@/domain/job-submission";
import {
  assertCanManageQuotations,
  assertQuotationTransition,
  DEFAULT_QUOTATION_VALIDITY_DAYS,
  effectiveQuotationStatus,
  normalizeQuotationCustomerNote,
  normalizeWithdrawalReason,
  QUOTATION_AUDIT_ACTIONS,
  QuotationPolicyError,
  quotationExpiryFromDays,
  validateQuotationTerms,
  type QuotationLineItemInput,
} from "@/domain/quotation-policy";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";
import {
  notifyCustomerOfQuotationIssued,
  notifyCustomerOfQuotationOutcome,
} from "@/server/notifications/events";

import { QuotationOperationError } from "./errors";

const MAX_TRANSACTION_ATTEMPTS = 3;
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateQuotationReference(now = new Date()) {
  const date = now.toISOString().slice(2, 10).replaceAll("-", "");
  const token = Array.from(randomBytes(6), (byte) =>
    REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
  ).join("");
  return `QT-${date}-${token}`;
}

function isRetryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

function mapPolicyError(error: unknown): never {
  if (error instanceof QuotationPolicyError) {
    throw new QuotationOperationError(
      error.code === "INVALID_TRANSITION"
        ? "INVALID_TRANSITION"
        : "INVALID_INPUT",
    );
  }
  throw error;
}

function jsonLineItems(value: object[]) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonArray;
}

async function ensureActiveManager(
  transaction: Prisma.TransactionClient,
  actor: ApplicationPrincipal,
) {
  assertCanManageQuotations(actor.role);
  const membership = await transaction.businessMembership.findFirst({
    where: {
      business: { archivedAt: null, isActive: true },
      businessId: actor.businessId,
      deactivatedAt: null,
      id: actor.membershipId,
      role: { in: ["ADMIN", "OWNER"] },
      status: "ACTIVE",
      user: { deactivatedAt: null, id: actor.userId },
    },
    select: { id: true },
  });
  if (!membership) {
    throw new QuotationOperationError("BUSINESS_UNAVAILABLE");
  }
}

async function withManagerTransaction<T>(
  actor: ApplicationPrincipal,
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  assertCanManageQuotations(actor.role);
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          await ensureActiveManager(transaction, actor);
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

function requireManualSnapshot(value: unknown) {
  if (!isJobSubmissionSnapshot(value) || value.pricing.mode !== "ON_REQUEST") {
    throw new QuotationOperationError("FIXED_PRICE_JOB");
  }
  return value;
}

export async function saveQuotationDraft(
  actor: ApplicationPrincipal,
  input: {
    customerNote: string;
    expectedVersion?: number;
    items: readonly QuotationLineItemInput[];
    publicReference: string;
    quotationId?: string;
    validityDays: number;
  },
) {
  let customerNote: string | null;
  let expiresAt: Date;
  try {
    customerNote = normalizeQuotationCustomerNote(input.customerNote);
    expiresAt = quotationExpiryFromDays(input.validityDays);
  } catch (error) {
    mapPolicyError(error);
  }

  return withManagerTransaction(actor, async (transaction) => {
    const job = await transaction.job.findFirst({
      where: {
        archivedAt: null,
        businessId: actor.businessId,
        publicReference: input.publicReference,
      },
      select: {
        business: { select: { defaultCurrency: true } },
        id: true,
        priority: true,
        submissionSnapshot: true,
      },
    });
    if (!job) throw new QuotationOperationError("NOT_FOUND");
    requireManualSnapshot(job.submissionSnapshot);

    let terms;
    try {
      terms = validateQuotationTerms(input.items, job.priority);
    } catch (error) {
      mapPolicyError(error);
    }

    if (input.quotationId) {
      if (!input.expectedVersion || input.expectedVersion < 1) {
        throw new QuotationOperationError("INVALID_INPUT");
      }
      const current = await transaction.jobQuotation.findFirst({
        where: {
          businessId: actor.businessId,
          id: input.quotationId,
          jobId: job.id,
          status: "DRAFT",
        },
        select: { id: true, rowVersion: true },
      });
      if (!current) throw new QuotationOperationError("NOT_FOUND");
      if (current.rowVersion !== input.expectedVersion) {
        throw new QuotationOperationError("STALE_UPDATE");
      }
      const result = await transaction.jobQuotation.updateMany({
        where: {
          businessId: actor.businessId,
          id: current.id,
          rowVersion: input.expectedVersion,
          status: "DRAFT",
        },
        data: {
          customerNote,
          expiresAt,
          expressSurchargeBasisPoints: terms.expressSurchargeBasisPoints,
          expressSurchargeMinor: terms.expressSurchargeMinor,
          lineItems: jsonLineItems(terms.lineItems),
          rowVersion: { increment: 1 },
          subtotalMinor: terms.subtotalMinor,
          totalMinor: terms.totalMinor,
          validityDays: input.validityDays,
        },
      });
      if (result.count !== 1) {
        throw new QuotationOperationError("STALE_UPDATE");
      }
      await transaction.auditLog.create({
        data: {
          action: QUOTATION_AUDIT_ACTIONS.DRAFT_UPDATED,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.userId,
          businessId: actor.businessId,
          metadata: { lineItemCount: terms.lineItems.length },
          targetId: current.id,
          targetType: "JobQuotation",
        },
      });
      return { id: current.id, rowVersion: input.expectedVersion + 1 };
    }

    const existingDraft = await transaction.jobQuotation.findFirst({
      where: { businessId: actor.businessId, jobId: job.id, status: "DRAFT" },
      select: { id: true },
    });
    if (existingDraft) throw new QuotationOperationError("DUPLICATE_OPERATION");
    const latest = await transaction.jobQuotation.aggregate({
      where: { businessId: actor.businessId, jobId: job.id },
      _max: { quotationVersion: true },
    });
    const quotation = await transaction.jobQuotation.create({
      data: {
        businessId: actor.businessId,
        createdByMembershipId: actor.membershipId,
        currency: job.business.defaultCurrency,
        customerNote,
        expiresAt,
        expressSurchargeBasisPoints: terms.expressSurchargeBasisPoints,
        expressSurchargeMinor: terms.expressSurchargeMinor,
        jobId: job.id,
        lineItems: jsonLineItems(terms.lineItems),
        priority: job.priority,
        publicReference: generateQuotationReference(),
        quotationVersion: (latest._max.quotationVersion ?? 0) + 1,
        subtotalMinor: terms.subtotalMinor,
        totalMinor: terms.totalMinor,
        validityDays: input.validityDays,
      },
    });
    await transaction.auditLog.create({
      data: {
        action: QUOTATION_AUDIT_ACTIONS.DRAFT_CREATED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: {
          jobId: job.id,
          quotationVersion: quotation.quotationVersion,
        },
        targetId: quotation.id,
        targetType: "JobQuotation",
      },
    });
    return { id: quotation.id, rowVersion: quotation.rowVersion };
  });
}

export async function createQuotationRevision(
  actor: ApplicationPrincipal,
  input: { expectedVersion: number; quotationId: string },
) {
  return withManagerTransaction(actor, async (transaction) => {
    const source = await transaction.jobQuotation.findFirst({
      where: {
        businessId: actor.businessId,
        id: input.quotationId,
        rowVersion: input.expectedVersion,
        status: { in: ["ISSUED", "DECLINED", "EXPIRED", "WITHDRAWN"] },
      },
    });
    if (!source) throw new QuotationOperationError("INVALID_TRANSITION");
    const existingDraft = await transaction.jobQuotation.findFirst({
      where: { businessId: actor.businessId, jobId: source.jobId, status: "DRAFT" },
      select: { id: true },
    });
    if (existingDraft) throw new QuotationOperationError("DUPLICATE_OPERATION");
    const latest = await transaction.jobQuotation.aggregate({
      where: { businessId: actor.businessId, jobId: source.jobId },
      _max: { quotationVersion: true },
    });
    const quotation = await transaction.jobQuotation.create({
      data: {
        businessId: actor.businessId,
        createdByMembershipId: actor.membershipId,
        currency: source.currency,
        customerNote: source.customerNote,
        expiresAt: quotationExpiryFromDays(DEFAULT_QUOTATION_VALIDITY_DAYS),
        expressSurchargeBasisPoints: source.expressSurchargeBasisPoints,
        expressSurchargeMinor: source.expressSurchargeMinor,
        jobId: source.jobId,
        lineItems: source.lineItems as Prisma.InputJsonValue,
        priority: source.priority,
        publicReference: generateQuotationReference(),
        quotationVersion: (latest._max.quotationVersion ?? 0) + 1,
        replacesQuotationId: source.id,
        subtotalMinor: source.subtotalMinor,
        totalMinor: source.totalMinor,
        validityDays: DEFAULT_QUOTATION_VALIDITY_DAYS,
      },
    });
    await transaction.auditLog.create({
      data: {
        action: QUOTATION_AUDIT_ACTIONS.DRAFT_CREATED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { replacesQuotationId: source.id },
        targetId: quotation.id,
        targetType: "JobQuotation",
      },
    });
    return quotation;
  });
}

export async function issueQuotation(
  actor: ApplicationPrincipal,
  input: { expectedVersion: number; quotationId: string },
) {
  return withManagerTransaction(actor, async (transaction) => {
    const draft = await transaction.jobQuotation.findFirst({
      where: {
        businessId: actor.businessId,
        id: input.quotationId,
        rowVersion: input.expectedVersion,
        status: "DRAFT",
      },
      select: {
        id: true,
        job: {
          select: {
            customer: { select: { userId: true } },
            publicReference: true,
            service: { select: { allowPriceNegotiation: true } },
          },
        },
        jobId: true,
        quotationVersion: true,
        validityDays: true,
      },
    });
    if (!draft) throw new QuotationOperationError("STALE_UPDATE");
    const now = new Date();

    const currentIssued = await transaction.jobQuotation.findFirst({
      where: { businessId: actor.businessId, jobId: draft.jobId, status: "ISSUED" },
      select: { id: true, rowVersion: true },
    });
    if (currentIssued) {
      assertQuotationTransition("ISSUED", "SUPERSEDED");
      await transaction.quotationCounteroffer.updateMany({
        where: {
          businessId: actor.businessId,
          quotationId: currentIssued.id,
          status: "PENDING",
        },
        data: {
          respondedAt: now,
          reviewedByMembershipId: actor.membershipId,
          status: "SUPERSEDED",
        },
      });
      await transaction.jobQuotation.update({
        where: { id: currentIssued.id },
        data: {
          rowVersion: { increment: 1 },
          status: "SUPERSEDED",
          supersededAt: now,
        },
      });
      await transaction.auditLog.create({
        data: {
          action: QUOTATION_AUDIT_ACTIONS.SUPERSEDED,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.userId,
          businessId: actor.businessId,
          metadata: { replacementQuotationId: draft.id },
          targetId: currentIssued.id,
          targetType: "JobQuotation",
        },
      });
    }

    assertQuotationTransition("DRAFT", "ISSUED");
    const result = await transaction.jobQuotation.updateMany({
      where: {
        businessId: actor.businessId,
        id: draft.id,
        rowVersion: input.expectedVersion,
        status: "DRAFT",
      },
      data: {
        issuedAt: now,
        issuedByMembershipId: actor.membershipId,
        negotiationAllowed: draft.job.service.allowPriceNegotiation,
        expiresAt: quotationExpiryFromDays(draft.validityDays, now),
        rowVersion: { increment: 1 },
        status: "ISSUED",
      },
    });
    if (result.count !== 1) throw new QuotationOperationError("STALE_UPDATE");
    await transaction.auditLog.create({
      data: {
        action: QUOTATION_AUDIT_ACTIONS.ISSUED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: {
          negotiationAllowed: draft.job.service.allowPriceNegotiation,
          quotationVersion: draft.quotationVersion,
        },
        targetId: draft.id,
        targetType: "JobQuotation",
      },
    });
    await notifyCustomerOfQuotationIssued(transaction, {
      businessId: actor.businessId,
      customerUserId: draft.job.customer?.userId ?? null,
      publicReference: draft.job.publicReference,
      quotationId: draft.id,
      quotationVersion: draft.quotationVersion,
    });
    return { rowVersion: input.expectedVersion + 1 };
  });
}

export async function withdrawQuotation(
  actor: ApplicationPrincipal,
  input: {
    expectedVersion: number;
    quotationId: string;
    reason: string;
  },
) {
  let reason: string;
  try {
    reason = normalizeWithdrawalReason(input.reason);
  } catch (error) {
    mapPolicyError(error);
  }
  return withManagerTransaction(actor, async (transaction) => {
    const quotation = await transaction.jobQuotation.findFirst({
      where: {
        businessId: actor.businessId,
        id: input.quotationId,
        rowVersion: input.expectedVersion,
        status: { in: ["DRAFT", "ISSUED"] },
      },
      select: {
        expiresAt: true,
        id: true,
        job: {
          select: {
            customer: { select: { userId: true } },
            publicReference: true,
          },
        },
        status: true,
      },
    });
    if (!quotation) throw new QuotationOperationError("INVALID_TRANSITION");
    const now = new Date();
    if (effectiveQuotationStatus(quotation.status, quotation.expiresAt, now) === "EXPIRED") {
      await transaction.jobQuotation.update({
        where: { id: quotation.id },
        data: { rowVersion: { increment: 1 }, status: "EXPIRED" },
      });
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
      if (quotation.status === "ISSUED") {
        await notifyCustomerOfQuotationOutcome(transaction, {
          businessId: actor.businessId,
          customerUserId: quotation.job.customer?.userId ?? null,
          outcome: "EXPIRED",
          publicReference: quotation.job.publicReference,
          quotationId: quotation.id,
        });
      }
      return { expired: true };
    }
    assertQuotationTransition(quotation.status, "WITHDRAWN");
    await transaction.quotationCounteroffer.updateMany({
      where: {
        businessId: actor.businessId,
        quotationId: quotation.id,
        status: "PENDING",
      },
      data: {
        respondedAt: now,
        reviewedByMembershipId: actor.membershipId,
        status: "SUPERSEDED",
      },
    });
    await transaction.jobQuotation.update({
      where: { id: quotation.id },
      data: {
        rowVersion: { increment: 1 },
        status: "WITHDRAWN",
        withdrawalReason: reason,
        withdrawnAt: now,
        withdrawnByMembershipId: actor.membershipId,
      },
    });
    await transaction.auditLog.create({
      data: {
        action: QUOTATION_AUDIT_ACTIONS.WITHDRAWN,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { reason },
        targetId: quotation.id,
        targetType: "JobQuotation",
      },
    });
    if (quotation.status === "ISSUED") {
      await notifyCustomerOfQuotationOutcome(transaction, {
        businessId: actor.businessId,
        customerUserId: quotation.job.customer?.userId ?? null,
        outcome: "WITHDRAWN",
        publicReference: quotation.job.publicReference,
        quotationId: quotation.id,
      });
    }
    return { expired: false };
  }).then((result) => {
    if (result.expired) throw new QuotationOperationError("EXPIRED");
    return result;
  });
}

export async function declineCounteroffer(
  actor: ApplicationPrincipal,
  input: { counterofferId: string },
) {
  return withManagerTransaction(actor, async (transaction) => {
    const counteroffer = await transaction.quotationCounteroffer.findFirst({
      where: {
        businessId: actor.businessId,
        id: input.counterofferId,
        status: "PENDING",
      },
      select: {
        id: true,
        quotation: {
          select: {
            job: {
              select: {
                customer: { select: { userId: true } },
                publicReference: true,
              },
            },
          },
        },
        quotationId: true,
      },
    });
    if (!counteroffer) throw new QuotationOperationError("INVALID_TRANSITION");
    const now = new Date();
    const result = await transaction.quotationCounteroffer.updateMany({
      where: {
        businessId: actor.businessId,
        id: counteroffer.id,
        status: "PENDING",
      },
      data: {
        respondedAt: now,
        reviewedByMembershipId: actor.membershipId,
        status: "DECLINED",
      },
    });
    if (result.count !== 1) throw new QuotationOperationError("STALE_UPDATE");
    await transaction.auditLog.create({
      data: {
        action: QUOTATION_AUDIT_ACTIONS.COUNTEROFFER_DECLINED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { counterofferId: counteroffer.id },
        targetId: counteroffer.quotationId,
        targetType: "JobQuotation",
      },
    });
    await notifyCustomerOfQuotationOutcome(transaction, {
      businessId: actor.businessId,
      customerUserId: counteroffer.quotation.job.customer?.userId ?? null,
      outcome: "COUNTEROFFER_DECLINED",
      publicReference: counteroffer.quotation.job.publicReference,
      quotationId: counteroffer.quotationId,
    });
    return { id: counteroffer.id };
  });
}
