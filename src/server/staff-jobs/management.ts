import "server-only";

import {
  assertCanManageStaffJobs,
  assertStaffJobTransition,
  normalizeInternalNote,
  STAFF_JOB_AUDIT_ACTIONS,
  StaffJobPolicyError,
} from "@/domain/staff-job-policy";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";

import { StaffJobOperationError } from "./errors";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function validateReference(publicReference: string) {
  const normalized = publicReference.trim();
  if (!normalized || normalized.length > 32) {
    throw new StaffJobOperationError("INVALID_INPUT");
  }
  return normalized;
}

async function ensureActiveStaff(
  transaction: Prisma.TransactionClient,
  actor: ApplicationPrincipal,
) {
  assertCanManageStaffJobs(actor.role);
  const membership = await transaction.businessMembership.findFirst({
    where: {
      business: { archivedAt: null, isActive: true },
      businessId: actor.businessId,
      deactivatedAt: null,
      id: actor.membershipId,
      role: { in: ["WORKER", "ADMIN", "OWNER"] },
      status: "ACTIVE",
      user: { deactivatedAt: null, id: actor.userId },
    },
    select: { id: true },
  });
  if (!membership) {
    throw new StaffJobOperationError("BUSINESS_UNAVAILABLE");
  }
}

function mapPolicyError(error: unknown): never {
  if (error instanceof StaffJobPolicyError) {
    throw new StaffJobOperationError(
      error.code === "INVALID_TRANSITION" ? "INVALID_TRANSITION" : "INVALID_INPUT",
    );
  }
  throw error;
}

export async function startStaffJobReview(
  actor: ApplicationPrincipal,
  input: { expectedVersion: number; publicReference: string },
) {
  assertCanManageStaffJobs(actor.role);
  const publicReference = validateReference(input.publicReference);
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new StaffJobOperationError("INVALID_INPUT");
  }

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          await ensureActiveStaff(transaction, actor);
          const job = await transaction.job.findFirst({
            where: {
              archivedAt: null,
              businessId: actor.businessId,
              publicReference,
            },
            select: { currentStatus: true, id: true, version: true },
          });
          if (!job) {
            throw new StaffJobOperationError("NOT_FOUND");
          }
          if (job.version !== input.expectedVersion) {
            throw new StaffJobOperationError("STALE_UPDATE");
          }
          try {
            assertStaffJobTransition(job.currentStatus, "UNDER_REVIEW");
          } catch (error) {
            mapPolicyError(error);
          }

          const reviewedAt = new Date();
          const updated = await transaction.job.updateMany({
            where: {
              archivedAt: null,
              businessId: actor.businessId,
              currentStatus: "SUBMITTED",
              id: job.id,
              version: input.expectedVersion,
            },
            data: {
              currentStatus: "UNDER_REVIEW",
              reviewedAt,
              reviewedByMembershipId: actor.membershipId,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) {
            throw new StaffJobOperationError("STALE_UPDATE");
          }

          await transaction.jobStatusHistory.create({
            data: {
              actorMembershipId: actor.membershipId,
              actorUserId: actor.userId,
              businessId: actor.businessId,
              fromStatus: "SUBMITTED",
              jobId: job.id,
              reason: "Staff review started.",
              toStatus: "UNDER_REVIEW",
            },
          });
          await transaction.auditLog.create({
            data: {
              action: STAFF_JOB_AUDIT_ACTIONS.REVIEW_STARTED,
              actorMembershipId: actor.membershipId,
              actorUserId: actor.userId,
              businessId: actor.businessId,
              metadata: { fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW" },
              targetId: job.id,
              targetType: "Job",
            },
          });

          return { reviewedAt, version: input.expectedVersion + 1 };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }
  throw new StaffJobOperationError("STALE_UPDATE");
}

export async function addInternalJobNote(
  actor: ApplicationPrincipal,
  input: { body: string; publicReference: string },
) {
  assertCanManageStaffJobs(actor.role);
  const publicReference = validateReference(input.publicReference);
  let body: string;
  try {
    body = normalizeInternalNote(input.body);
  } catch (error) {
    mapPolicyError(error);
  }

  return prisma.$transaction(
    async (transaction) => {
      await ensureActiveStaff(transaction, actor);
      const job = await transaction.job.findFirst({
        where: {
          archivedAt: null,
          businessId: actor.businessId,
          publicReference,
        },
        select: { id: true },
      });
      if (!job) {
        throw new StaffJobOperationError("NOT_FOUND");
      }

      const note = await transaction.jobNote.create({
        data: {
          authorMembershipId: actor.membershipId,
          body,
          businessId: actor.businessId,
          jobId: job.id,
        },
      });
      await transaction.auditLog.create({
        data: {
          action: STAFF_JOB_AUDIT_ACTIONS.NOTE_ADDED,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.userId,
          businessId: actor.businessId,
          metadata: { noteId: note.id },
          targetId: job.id,
          targetType: "Job",
        },
      });
      return note;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
