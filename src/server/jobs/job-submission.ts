import "server-only";

import { randomBytes } from "node:crypto";

import {
  JobSubmissionValidationError,
  validateJobSubmission,
  type JobSubmissionPayload,
  type SubmissionService,
} from "@/domain/job-submission";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";
import { notifyManagementOfNewJob } from "@/server/notifications/events";

import { JobOperationError } from "./errors";
import {
  resolveCustomerUploads,
  type ResolvedCustomerUpload,
} from "./uploads";

const MAX_TRANSACTION_ATTEMPTS = 3;
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateJobReference(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const bytes = randomBytes(7);
  const token = Array.from(bytes, (byte) =>
    REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
  ).join("");
  return `JS-${date}-${token}`;
}

function isRetryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

function jsonValue(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function findOwnedExistingSubmission(
  actor: ApplicationPrincipal,
  submissionKey: string,
) {
  return prisma.job.findFirst({
    where: {
      businessId: actor.businessId,
      customer: { userId: actor.userId },
      submissionKey,
    },
    select: {
      currentStatus: true,
      id: true,
      publicReference: true,
      service: { select: { name: true } },
    },
  });
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
    select: { business: { select: { acceptingNewJobs: true } }, id: true },
  });
  if (!membership) {
    throw new JobOperationError("BUSINESS_UNAVAILABLE");
  }
  if (!membership.business.acceptingNewJobs) {
    throw new JobOperationError("SHOP_CLOSED");
  }
}

function serviceSelection() {
  return {
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
}

function validate(
  payload: JobSubmissionPayload,
  service: SubmissionService,
) {
  try {
    return validateJobSubmission(payload, service);
  } catch (error) {
    if (error instanceof JobSubmissionValidationError) {
      if (error.code === "SERVICE_UNAVAILABLE") {
        throw new JobOperationError("SERVICE_UNAVAILABLE");
      }
      throw new JobOperationError("SUBMISSION_INVALID");
    }
    throw error;
  }
}

async function createInTransaction(
  actor: ApplicationPrincipal,
  payload: JobSubmissionPayload,
  uploads: readonly ResolvedCustomerUpload[],
) {
  return prisma.$transaction(
    async (transaction) => {
      await ensureActiveCustomer(transaction, actor);

      const existing = await transaction.job.findUnique({
        where: { submissionKey: payload.idempotencyKey },
        include: { customer: { select: { userId: true } }, service: { select: { name: true } } },
      });
      if (existing) {
        if (existing.businessId !== actor.businessId || existing.customer?.userId !== actor.userId) {
          throw new JobOperationError("DUPLICATE_SUBMISSION");
        }
        return {
          currentStatus: existing.currentStatus,
          id: existing.id,
          publicReference: existing.publicReference,
          service: existing.service,
        };
      }

      const service = await transaction.service.findFirst({
        where: { businessId: actor.businessId, id: payload.serviceId },
        select: serviceSelection(),
      });
      if (!service) {
        throw new JobOperationError("SERVICE_UNAVAILABLE");
      }
      const submission = validate(payload, service);
      const job = await transaction.job.create({
        data: {
          businessId: actor.businessId,
          complexity: submission.complexity,
          instructions: submission.instructions,
          priority: submission.priority,
          publicReference: generateJobReference(),
          quantity: submission.quantity,
          serviceId: service.id,
          source: "CUSTOMER_PORTAL",
          submissionKey: payload.idempotencyKey,
          submissionSnapshot: jsonValue(submission.snapshot),
          title: submission.title,
          workloadClass: submission.workloadClass,
        },
      });

      await transaction.jobCustomer.create({
        data: {
          businessId: actor.businessId,
          displayName: actor.displayName,
          email: actor.email,
          jobId: job.id,
          userId: actor.userId,
        },
      });
      await transaction.jobStatusHistory.create({
        data: {
          actorMembershipId: actor.membershipId,
          actorUserId: actor.userId,
          businessId: actor.businessId,
          jobId: job.id,
          reason: "Customer submitted the job request.",
          toStatus: "SUBMITTED",
        },
      });

      const now = new Date();
      for (const upload of uploads) {
        const claimed = await transaction.customerUpload.updateMany({
          where: {
            businessId: actor.businessId,
            expiresAt: { gt: now },
            id: upload.uploadId,
            status: { in: ["PENDING", "UPLOADED"] },
            userId: actor.userId,
            OR: [{ storageKey: null }, { storageKey: upload.pathname }],
          },
          data: {
            byteSize: BigInt(upload.byteSize),
            claimedAt: now,
            jobId: job.id,
            mimeType: upload.mimeType,
            status: "CLAIMED",
            storageKey: upload.pathname,
            uploadedAt: now,
          },
        });
        if (claimed.count !== 1) {
          throw new JobOperationError("ATTACHMENT_USED");
        }
        await transaction.jobAttachment.create({
          data: {
            businessId: actor.businessId,
            byteSize: BigInt(upload.byteSize),
            jobId: job.id,
            mimeType: upload.mimeType,
            originalFilename: upload.originalFilename,
            purpose: "CUSTOMER_ORIGINAL",
            storageKey: upload.pathname,
            uploaderUserId: actor.userId,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          action: "job.customer_submitted",
          actorMembershipId: actor.membershipId,
          actorUserId: actor.userId,
          businessId: actor.businessId,
          metadata: {
            attachmentCount: uploads.length,
            pricingMode: submission.snapshot.pricing.mode,
            priority: submission.priority,
            quantity: submission.quantity,
            serviceId: service.id,
            status: "SUBMITTED",
          },
          targetId: job.id,
          targetType: "Job",
        },
      });
      await notifyManagementOfNewJob(transaction, {
        businessId: actor.businessId,
        jobId: job.id,
        pricingMode: submission.snapshot.pricing.mode,
        priority: submission.priority,
        publicReference: job.publicReference,
        serviceName: service.name,
      });

      return {
        currentStatus: job.currentStatus,
        id: job.id,
        publicReference: job.publicReference,
        service: { name: service.name },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createCustomerJob(
  actor: ApplicationPrincipal,
  payload: JobSubmissionPayload,
) {
  const existing = await findOwnedExistingSubmission(actor, payload.idempotencyKey);
  if (existing) {
    return existing;
  }

  const service = await prisma.service.findFirst({
    where: { businessId: actor.businessId, id: payload.serviceId },
    select: serviceSelection(),
  });
  if (!service) {
    throw new JobOperationError("SERVICE_UNAVAILABLE");
  }
  const submission = validate(payload, service);
  const uploads = await resolveCustomerUploads(actor, submission.attachments);

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await createInTransaction(actor, payload, uploads);
    } catch (error) {
      if (!isRetryable(error)) {
        throw error;
      }
      const concurrent = await findOwnedExistingSubmission(
        actor,
        payload.idempotencyKey,
      );
      if (concurrent) {
        return concurrent;
      }
      if (attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw new JobOperationError("DUPLICATE_SUBMISSION");
      }
    }
  }
  throw new JobOperationError("DUPLICATE_SUBMISSION");
}
