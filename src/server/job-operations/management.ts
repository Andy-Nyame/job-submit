import "server-only";

import {
  ACTIVE_WORKLOAD_STATUSES,
  assertCanManageOperations,
  assertProductionTransition,
  canManageOperations,
  hasConfirmedOperationalPrice,
  JOB_OPERATION_AUDIT_ACTIONS,
  JobOperationsPolicyError,
  normalizeOperationReason,
  pickupChecklistComplete,
  validatePackageCount,
  type ProductionStatus,
} from "@/domain/job-operations";
import { canAcceptConfiguredWorkload } from "@/domain/team-policy";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";
import { prisma } from "@/server/db/prisma";
import {
  notifyCustomerOfJobStatus,
  notifyManagementOfPickup,
  notifyWorkerOfAssignment,
} from "@/server/notifications/events";
import { StaffJobOperationError } from "@/server/staff-jobs/errors";

import {
  decryptPickupCode,
  displayPickupCode,
  encryptPickupCode,
  generatePickupCode,
  hashPickupCode,
  isPickupCodeShape,
  normalizePickupCode,
} from "./pickup-credentials";

const MAX_TRANSACTION_ATTEMPTS = 3;
const PICKUP_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

function retryable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function reference(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,32}$/u.test(normalized)) {
    throw new StaffJobOperationError("INVALID_INPUT");
  }
  return normalized;
}

function policyError(error: unknown): never {
  if (error instanceof JobOperationsPolicyError) {
    const mapped = {
      INVALID_PACKAGE_COUNT: "INVALID_INPUT",
      INVALID_REASON: "INVALID_INPUT",
      INVALID_TRANSITION: "INVALID_TRANSITION",
      MANAGEMENT_REQUIRED: "MANAGEMENT_REQUIRED",
      PRICING_NOT_CONFIRMED: "PRICING_NOT_CONFIRMED",
    } as const;
    throw new StaffJobOperationError(mapped[error.code]);
  }
  throw error;
}

async function transactionWithRetry<T>(run: (transaction: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(run, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!retryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) throw error;
    }
  }
  throw new StaffJobOperationError("STALE_UPDATE");
}

async function ensureActiveStaff(
  transaction: Prisma.TransactionClient,
  actor: ApplicationPrincipal,
) {
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
  if (!membership) throw new StaffJobOperationError("BUSINESS_UNAVAILABLE");
}

async function assertWorkerEligible(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    serviceId: string;
    workerMembershipId: string;
    workloadClass: "FOCUS" | "QUICK" | "STANDARD" | null;
  },
) {
  if (!input.workloadClass) throw new StaffJobOperationError("WORKER_NOT_ELIGIBLE");
  const worker = await transaction.businessMembership.findFirst({
    where: {
      businessId: input.businessId,
      deactivatedAt: null,
      id: input.workerMembershipId,
      role: "WORKER",
      status: "ACTIVE",
      user: { deactivatedAt: null },
      workerProfile: {
        archivedAt: null,
        isActive: true,
        skills: {
          some: {
            deactivatedAt: null,
            isActive: true,
            serviceId: input.serviceId,
          },
        },
      },
    },
    select: {
      user: { select: { id: true } },
      workerProfile: {
        select: {
          canTakeFocus: true,
          maxQuickWorkload: true,
          maxStandardWorkload: true,
        },
      },
    },
  });
  if (!worker?.workerProfile) throw new StaffJobOperationError("WORKER_NOT_ELIGIBLE");
  const counts = await Promise.all(
    (["FOCUS", "QUICK", "STANDARD"] as const).map((workloadClass) =>
      transaction.jobAssignment.count({
        where: {
          businessId: input.businessId,
          releasedAt: null,
          workerMembershipId: input.workerMembershipId,
          job: {
            currentStatus: { in: [...ACTIVE_WORKLOAD_STATUSES] },
            workloadClass,
          },
        },
      }),
    ),
  );
  const allowed = canAcceptConfiguredWorkload({
    activeFocusAssignments: counts[0],
    activeQuickAssignments: counts[1],
    activeStandardAssignments: counts[2],
    isOperational: true,
    requested: input.workloadClass,
    settings: worker.workerProfile,
  });
  if (!allowed) throw new StaffJobOperationError("CAPACITY_UNAVAILABLE");
  return worker.user.id;
}

async function issuePickupCredential(
  transaction: Prisma.TransactionClient,
  input: { actor: ApplicationPrincipal; jobId: string },
) {
  const code = generatePickupCode();
  const now = new Date();
  const verification = await transaction.pickupVerification.create({
    data: {
      businessId: input.actor.businessId,
      codeCiphertext: encryptPickupCode(code),
      codeHash: hashPickupCode(code),
      codeHint: code.slice(-4),
      expiresAt: new Date(now.getTime() + PICKUP_LIFETIME_MS),
      issuedAt: now,
      issuedByMembershipId: input.actor.membershipId,
      jobId: input.jobId,
    },
  });
  return { code, verification };
}

export async function releaseJobForProduction(
  actor: ApplicationPrincipal,
  input: { expectedVersion: number; publicReference: string },
) {
  try {
    assertCanManageOperations(actor.role);
  } catch (error) {
    policyError(error);
  }
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const publicReference = reference(input.publicReference);
    const job = await transaction.job.findFirst({
      where: { archivedAt: null, businessId: actor.businessId, publicReference },
      select: {
        currentStatus: true,
        dependencyClearedAt: true,
        dependsOnJobId: true,
        id: true,
        quotations: { where: { status: "ACCEPTED" }, select: { id: true }, take: 1 },
        submissionSnapshot: true,
        version: true,
      },
    });
    if (!job) throw new StaffJobOperationError("NOT_FOUND");
    if (job.version !== input.expectedVersion) throw new StaffJobOperationError("STALE_UPDATE");
    if (job.currentStatus !== "UNDER_REVIEW") throw new StaffJobOperationError("INVALID_TRANSITION");
    if (job.dependsOnJobId && !job.dependencyClearedAt) {
      throw new StaffJobOperationError("DEPENDENCY_PENDING");
    }
    if (!hasConfirmedOperationalPrice({
      acceptedQuotationExists: job.quotations.length > 0,
      submissionSnapshot: job.submissionSnapshot,
    })) {
      throw new StaffJobOperationError("PRICING_NOT_CONFIRMED");
    }
    const now = new Date();
    const updated = await transaction.job.updateMany({
      where: { businessId: actor.businessId, currentStatus: "UNDER_REVIEW", id: job.id, version: input.expectedVersion },
      data: {
        acceptedAt: now,
        acceptedByMembershipId: actor.membershipId,
        currentStatus: "ACCEPTED",
        queueEnteredAt: now,
        queueOrderTier: 0,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new StaffJobOperationError("STALE_UPDATE");
    await transaction.jobStatusHistory.create({
      data: {
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        fromStatus: "UNDER_REVIEW",
        jobId: job.id,
        reason: "Management released the confirmed-price job to the production queue.",
        toStatus: "ACCEPTED",
      },
    });
    await transaction.auditLog.create({
      data: {
        action: JOB_OPERATION_AUDIT_ACTIONS.PRODUCTION_RELEASED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { fromStatus: "UNDER_REVIEW", toStatus: "ACCEPTED" },
        targetId: job.id,
        targetType: "Job",
      },
    });
    return { version: input.expectedVersion + 1 };
  });
}

export async function clearDesignDependency(
  actor: ApplicationPrincipal,
  input: { expectedVersion: number; publicReference: string; reason: string },
) {
  try { assertCanManageOperations(actor.role); } catch (error) { policyError(error); }
  let reason: string;
  try { reason = normalizeOperationReason(input.reason); } catch (error) { policyError(error); }
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const job = await transaction.job.findFirst({
      where: { archivedAt: null, businessId: actor.businessId, publicReference: reference(input.publicReference) },
      select: { dependencyClearedAt: true, dependsOnJobId: true, id: true, version: true },
    });
    if (!job) throw new StaffJobOperationError("NOT_FOUND");
    if (job.version !== input.expectedVersion) throw new StaffJobOperationError("STALE_UPDATE");
    if (!job.dependsOnJobId || job.dependencyClearedAt) throw new StaffJobOperationError("INVALID_TRANSITION");
    const now = new Date();
    const updated = await transaction.job.updateMany({
      where: { businessId: actor.businessId, dependencyClearedAt: null, dependsOnJobId: job.dependsOnJobId, id: job.id, version: input.expectedVersion },
      data: { dependencyClearedAt: now, dependencyClearedByMembershipId: actor.membershipId, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaffJobOperationError("STALE_UPDATE");
    await transaction.auditLog.create({
      data: { action: "job.design_dependency_cleared", actorMembershipId: actor.membershipId, actorUserId: actor.userId, businessId: actor.businessId, metadata: { prerequisiteJobId: job.dependsOnJobId, reason }, targetId: job.id, targetType: "Job" },
    });
    return { version: input.expectedVersion + 1 };
  });
}

export async function assignProductionJob(
  actor: ApplicationPrincipal,
  input: {
    expectedVersion: number;
    publicReference: string;
    workerMembershipId?: string;
  },
) {
  const claimed = actor.role === "WORKER";
  if (!claimed && !canManageOperations(actor.role)) {
    throw new StaffJobOperationError("MANAGEMENT_REQUIRED");
  }
  const workerMembershipId = claimed ? actor.membershipId : input.workerMembershipId?.trim();
  if (!workerMembershipId) throw new StaffJobOperationError("INVALID_INPUT");
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const job = await transaction.job.findFirst({
      where: { archivedAt: null, businessId: actor.businessId, publicReference: reference(input.publicReference) },
      select: {
        currentStatus: true,
        id: true,
        publicReference: true,
        serviceId: true,
        version: true,
        workloadClass: true,
      },
    });
    if (!job) throw new StaffJobOperationError("NOT_FOUND");
    if (job.version !== input.expectedVersion) throw new StaffJobOperationError("STALE_UPDATE");
    try {
      assertProductionTransition(job.currentStatus as ProductionStatus, "QUEUED");
    } catch (error) {
      policyError(error);
    }
    const workerUserId = await assertWorkerEligible(transaction, {
      businessId: actor.businessId,
      serviceId: job.serviceId,
      workerMembershipId,
      workloadClass: job.workloadClass,
    });
    const updated = await transaction.job.updateMany({
      where: { businessId: actor.businessId, currentStatus: "ACCEPTED", id: job.id, version: input.expectedVersion },
      data: { currentStatus: "QUEUED", version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaffJobOperationError("ASSIGNMENT_CONFLICT");
    let assignment;
    try {
      assignment = await transaction.jobAssignment.create({
        data: {
          assignedByMembershipId: claimed ? null : actor.membershipId,
          assignmentReason: claimed ? "Worker claimed eligible available work." : "Management assigned production work.",
          businessId: actor.businessId,
          isPrimary: true,
          jobId: job.id,
          kind: claimed ? "WORKER_CLAIM" : "STAFF_ASSIGNED",
          workerMembershipId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new StaffJobOperationError("ASSIGNMENT_CONFLICT");
      }
      throw error;
    }
    await transaction.jobStatusHistory.create({
      data: {
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        fromStatus: "ACCEPTED",
        jobId: job.id,
        reason: claimed ? "An eligible worker took this job." : "Management assigned this job to an eligible worker.",
        toStatus: "QUEUED",
      },
    });
    await transaction.auditLog.create({
      data: {
        action: claimed ? JOB_OPERATION_AUDIT_ACTIONS.CLAIMED : JOB_OPERATION_AUDIT_ACTIONS.ASSIGNED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { assignmentId: assignment.id, workerMembershipId },
        targetId: job.id,
        targetType: "Job",
      },
    });
    await notifyWorkerOfAssignment(transaction, {
      assignmentId: assignment.id,
      businessId: actor.businessId,
      claimed,
      publicReference: job.publicReference,
      workerUserId,
    });
    return { version: input.expectedVersion + 1 };
  });
}

export async function reassignProductionJob(
  actor: ApplicationPrincipal,
  input: { expectedVersion: number; publicReference: string; reason: string; workerMembershipId: string },
) {
  try {
    assertCanManageOperations(actor.role);
  } catch (error) {
    policyError(error);
  }
  let reason: string;
  try {
    reason = normalizeOperationReason(input.reason);
  } catch (error) {
    policyError(error);
  }
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const job = await transaction.job.findFirst({
      where: { archivedAt: null, businessId: actor.businessId, publicReference: reference(input.publicReference) },
      select: {
        assignments: { where: { isPrimary: true, releasedAt: null }, select: { id: true, workerMembershipId: true }, take: 1 },
        currentStatus: true,
        id: true,
        publicReference: true,
        serviceId: true,
        version: true,
        workloadClass: true,
      },
    });
    if (!job) throw new StaffJobOperationError("NOT_FOUND");
    if (job.version !== input.expectedVersion) throw new StaffJobOperationError("STALE_UPDATE");
    if (!["QUEUED", "PROCESSING", "PREPARING_FOR_PICKUP"].includes(job.currentStatus) || !job.assignments[0]) {
      throw new StaffJobOperationError("INVALID_TRANSITION");
    }
    if (job.assignments[0].workerMembershipId === input.workerMembershipId) {
      throw new StaffJobOperationError("INVALID_INPUT");
    }
    const workerUserId = await assertWorkerEligible(transaction, {
      businessId: actor.businessId,
      serviceId: job.serviceId,
      workerMembershipId: input.workerMembershipId,
      workloadClass: job.workloadClass,
    });
    const now = new Date();
    const released = await transaction.jobAssignment.updateMany({
      where: { businessId: actor.businessId, id: job.assignments[0].id, releasedAt: null },
      data: { releasedAt: now, releasedByMembershipId: actor.membershipId, releaseReason: reason },
    });
    if (released.count !== 1) throw new StaffJobOperationError("ASSIGNMENT_CONFLICT");
    const assignment = await transaction.jobAssignment.create({
      data: {
        assignedByMembershipId: actor.membershipId,
        assignmentReason: reason,
        businessId: actor.businessId,
        isPrimary: true,
        jobId: job.id,
        kind: "STAFF_ASSIGNED",
        workerMembershipId: input.workerMembershipId,
      },
    });
    const updated = await transaction.job.updateMany({
      where: { businessId: actor.businessId, id: job.id, version: input.expectedVersion },
      data: { version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaffJobOperationError("STALE_UPDATE");
    await transaction.auditLog.create({
      data: {
        action: JOB_OPERATION_AUDIT_ACTIONS.REASSIGNED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { assignmentId: assignment.id, priorAssignmentId: job.assignments[0].id, reason, workerMembershipId: input.workerMembershipId },
        targetId: job.id,
        targetType: "Job",
      },
    });
    await notifyWorkerOfAssignment(transaction, {
      assignmentId: assignment.id,
      businessId: actor.businessId,
      claimed: false,
      publicReference: job.publicReference,
      workerUserId,
    });
    return { version: input.expectedVersion + 1 };
  });
}

export async function overrideQueueOrder(
  actor: ApplicationPrincipal,
  input: { direction: "DEMOTE" | "PROMOTE"; expectedVersion: number; publicReference: string; reason: string },
) {
  try {
    assertCanManageOperations(actor.role);
  } catch (error) {
    policyError(error);
  }
  let reason: string;
  try {
    reason = normalizeOperationReason(input.reason);
  } catch (error) {
    policyError(error);
  }
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const job = await transaction.job.findFirst({
      where: { archivedAt: null, businessId: actor.businessId, publicReference: reference(input.publicReference) },
      select: { currentStatus: true, id: true, version: true },
    });
    if (!job) throw new StaffJobOperationError("NOT_FOUND");
    if (job.currentStatus !== "ACCEPTED") throw new StaffJobOperationError("INVALID_TRANSITION");
    if (job.version !== input.expectedVersion) throw new StaffJobOperationError("STALE_UPDATE");
    const now = new Date();
    await transaction.jobQueueOverride.updateMany({
      where: { businessId: actor.businessId, jobId: job.id, revokedAt: null },
      data: { revocationReason: "Replaced by a new queue override.", revokedAt: now, revokedByMembershipId: actor.membershipId },
    });
    const override = await transaction.jobQueueOverride.create({
      data: { businessId: actor.businessId, createdByMembershipId: actor.membershipId, direction: input.direction, jobId: job.id, reason },
    });
    const updated = await transaction.job.updateMany({
      where: { businessId: actor.businessId, currentStatus: "ACCEPTED", id: job.id, version: input.expectedVersion },
      data: { queueOrderTier: input.direction === "PROMOTE" ? -1 : 1, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaffJobOperationError("STALE_UPDATE");
    await transaction.auditLog.create({
      data: {
        action: JOB_OPERATION_AUDIT_ACTIONS.QUEUE_OVERRIDDEN,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { direction: input.direction, overrideId: override.id, reason },
        targetId: job.id,
        targetType: "Job",
      },
    });
    return { version: input.expectedVersion + 1 };
  });
}

export async function updatePhysicalPackageCount(
  actor: ApplicationPrincipal,
  input: { expectedVersion: number; packageCount: number; publicReference: string },
) {
  let packageCount: number;
  try {
    packageCount = validatePackageCount(input.packageCount);
  } catch (error) {
    policyError(error);
  }
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const job = await transaction.job.findFirst({
      where: { archivedAt: null, businessId: actor.businessId, publicReference: reference(input.publicReference) },
      select: {
        assignments: { where: { isPrimary: true, releasedAt: null, workerMembershipId: actor.membershipId }, select: { id: true }, take: 1 },
        currentStatus: true,
        id: true,
        packageCount: true,
        version: true,
      },
    });
    if (!job) throw new StaffJobOperationError("NOT_FOUND");
    if (!canManageOperations(actor.role) && (actor.role !== "WORKER" || job.assignments.length === 0)) {
      throw new StaffJobOperationError("MANAGEMENT_REQUIRED");
    }
    if (job.version !== input.expectedVersion) throw new StaffJobOperationError("STALE_UPDATE");
    if (["PICKED_UP", "CANCELLED", "DECLINED"].includes(job.currentStatus)) {
      throw new StaffJobOperationError("INVALID_TRANSITION");
    }
    const updated = await transaction.job.updateMany({
      where: { businessId: actor.businessId, id: job.id, version: input.expectedVersion },
      data: { packageCount, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaffJobOperationError("STALE_UPDATE");
    await transaction.auditLog.create({
      data: {
        action: JOB_OPERATION_AUDIT_ACTIONS.PACKAGE_COUNT_UPDATED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { after: packageCount, before: job.packageCount },
        targetId: job.id,
        targetType: "Job",
      },
    });
    return { version: input.expectedVersion + 1 };
  });
}

export async function changeProductionStatus(
  actor: ApplicationPrincipal,
  input: { expectedVersion: number; publicReference: string; toStatus: "PREPARING_FOR_PICKUP" | "PROCESSING" | "READY_FOR_PICKUP" },
) {
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const job = await transaction.job.findFirst({
      where: { archivedAt: null, businessId: actor.businessId, publicReference: reference(input.publicReference) },
      select: {
        assignments: { where: { isPrimary: true, releasedAt: null }, select: { id: true, workerMembershipId: true }, take: 1 },
        currentStatus: true,
        customer: { select: { userId: true } },
        id: true,
        publicReference: true,
        version: true,
      },
    });
    if (!job) throw new StaffJobOperationError("NOT_FOUND");
    if (job.version !== input.expectedVersion) throw new StaffJobOperationError("STALE_UPDATE");
    if (!canManageOperations(actor.role) && (actor.role !== "WORKER" || job.assignments[0]?.workerMembershipId !== actor.membershipId)) {
      throw new StaffJobOperationError("MANAGEMENT_REQUIRED");
    }
    try {
      assertProductionTransition(job.currentStatus as ProductionStatus, input.toStatus);
    } catch (error) {
      policyError(error);
    }
    const now = new Date();
    const updated = await transaction.job.updateMany({
      where: { businessId: actor.businessId, currentStatus: job.currentStatus, id: job.id, version: input.expectedVersion },
      data: { currentStatus: input.toStatus, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaffJobOperationError("STALE_UPDATE");
    const history = await transaction.jobStatusHistory.create({
      data: {
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        fromStatus: job.currentStatus,
        jobId: job.id,
        reason: input.toStatus === "PROCESSING" ? "Production work started." : input.toStatus === "PREPARING_FOR_PICKUP" ? "Production work finished and entered final checks." : "Final checks completed; the job is ready for secure pickup.",
        toStatus: input.toStatus,
      },
    });
    let pickupVerificationId: string | null = null;
    if (input.toStatus === "READY_FOR_PICKUP") {
      const { verification } = await issuePickupCredential(transaction, { actor, jobId: job.id });
      pickupVerificationId = verification.id;
      await transaction.auditLog.create({
        data: {
          action: JOB_OPERATION_AUDIT_ACTIONS.PICKUP_CREDENTIAL_ISSUED,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.userId,
          businessId: actor.businessId,
          metadata: { expiresAt: verification.expiresAt?.toISOString(), verificationId: verification.id },
          targetId: job.id,
          targetType: "Job",
        },
      });
    }
    if (input.toStatus === "PREPARING_FOR_PICKUP" && job.assignments[0]) {
      await transaction.jobAssignment.updateMany({
        where: { completedAt: null, id: job.assignments[0].id },
        data: { completedAt: now },
      });
    }
    await transaction.auditLog.create({
      data: {
        action: JOB_OPERATION_AUDIT_ACTIONS.PRODUCTION_STATUS_CHANGED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { fromStatus: job.currentStatus, pickupVerificationId, toStatus: input.toStatus },
        targetId: job.id,
        targetType: "Job",
      },
    });
    await notifyCustomerOfJobStatus(transaction, {
      businessId: actor.businessId,
      customerUserId: job.customer?.userId ?? null,
      historyId: history.id,
      jobId: job.id,
      publicReference: job.publicReference,
      status: input.toStatus,
    });
    return { version: input.expectedVersion + 1 };
  });
}

export async function reissuePickupCredential(
  actor: ApplicationPrincipal,
  input: { publicReference: string; reason: string },
) {
  try {
    assertCanManageOperations(actor.role);
  } catch (error) {
    policyError(error);
  }
  let reason: string;
  try {
    reason = normalizeOperationReason(input.reason);
  } catch (error) {
    policyError(error);
  }
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const job = await transaction.job.findFirst({
      where: { archivedAt: null, businessId: actor.businessId, publicReference: reference(input.publicReference) },
      select: { currentStatus: true, id: true },
    });
    if (!job) throw new StaffJobOperationError("NOT_FOUND");
    if (job.currentStatus !== "READY_FOR_PICKUP") throw new StaffJobOperationError("INVALID_TRANSITION");
    await transaction.pickupVerification.updateMany({
      where: { businessId: actor.businessId, jobId: job.id, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });
    const { verification } = await issuePickupCredential(transaction, { actor, jobId: job.id });
    await transaction.auditLog.create({
      data: {
        action: JOB_OPERATION_AUDIT_ACTIONS.PICKUP_CREDENTIAL_REISSUED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { expiresAt: verification.expiresAt?.toISOString(), reason, verificationId: verification.id },
        targetId: job.id,
        targetType: "Job",
      },
    });
    return { verificationId: verification.id };
  });
}

export async function getCustomerPickupCredential(
  actor: ApplicationPrincipal,
  jobId: string,
) {
  const verification = await prisma.pickupVerification.findFirst({
    where: {
      businessId: actor.businessId,
      job: { customer: { userId: actor.userId }, id: jobId },
      status: "ACTIVE",
    },
    orderBy: { issuedAt: "desc" },
    select: { codeCiphertext: true, expiresAt: true, id: true },
  });
  if (!verification || (verification.expiresAt && verification.expiresAt <= new Date())) return null;
  const code = decryptPickupCode(verification.codeCiphertext);
  return {
    code,
    displayCode: displayPickupCode(code),
    expiresAt: verification.expiresAt,
    id: verification.id,
  };
}

export async function inspectPickupCredential(actor: ApplicationPrincipal, rawCode: string) {
  if (!isPickupCodeShape(rawCode)) return null;
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const code = normalizePickupCode(rawCode);
    const verification = await transaction.pickupVerification.findFirst({
      where: { businessId: actor.businessId, codeHash: hashPickupCode(code) },
      select: {
        expiresAt: true,
        id: true,
        job: {
          select: {
            currentStatus: true,
            id: true,
            packageCount: true,
            priority: true,
            publicReference: true,
            quantity: true,
            service: { select: { name: true } },
            submissionSnapshot: true,
            title: true,
            version: true,
          },
        },
        status: true,
      },
    });
    if (
      !verification ||
      verification.status !== "ACTIVE" ||
      verification.job.currentStatus !== "READY_FOR_PICKUP" ||
      (verification.expiresAt && verification.expiresAt <= new Date())
    ) return null;
    return {
      code,
      expiresAt: verification.expiresAt?.toISOString() ?? null,
      job: verification.job,
      verificationId: verification.id,
    };
  });
}

export async function confirmJobPickup(
  actor: ApplicationPrincipal,
  input: {
    checklist: { collectorVerified: boolean; correctJob: boolean; correctSpecifications: boolean; packagesPresent: boolean };
    code?: string;
    overrideReason?: string;
    publicReference?: string;
  },
) {
  if (!pickupChecklistComplete(input.checklist)) throw new StaffJobOperationError("INVALID_INPUT");
  const manualOverride = Boolean(input.overrideReason || input.publicReference);
  let overrideReason: string | null = null;
  if (manualOverride) {
    try {
      assertCanManageOperations(actor.role);
      overrideReason = normalizeOperationReason(input.overrideReason);
    } catch (error) {
      policyError(error);
    }
  } else if (!input.code || !isPickupCodeShape(input.code)) {
    throw new StaffJobOperationError("CREDENTIAL_INVALID");
  }
  return transactionWithRetry(async (transaction) => {
    await ensureActiveStaff(transaction, actor);
    const verification = await transaction.pickupVerification.findFirst({
      where: manualOverride
        ? {
            businessId: actor.businessId,
            job: { publicReference: reference(input.publicReference ?? "") },
            status: "ACTIVE",
          }
        : {
            businessId: actor.businessId,
            codeHash: hashPickupCode(input.code ?? ""),
            status: "ACTIVE",
          },
      select: {
        expiresAt: true,
        id: true,
        job: { select: { currentStatus: true, customer: { select: { userId: true } }, id: true, publicReference: true } },
      },
    });
    if (!verification || verification.job.currentStatus !== "READY_FOR_PICKUP") {
      throw new StaffJobOperationError("CREDENTIAL_INVALID");
    }
    if (!manualOverride && verification.expiresAt && verification.expiresAt <= new Date()) {
      throw new StaffJobOperationError("CREDENTIAL_INVALID");
    }
    const now = new Date();
    const consumed = await transaction.pickupVerification.updateMany({
      where: { businessId: actor.businessId, id: verification.id, status: "ACTIVE" },
      data: {
        consumedAt: now,
        ...(manualOverride ? { overrideReason, overriddenAt: now, overriddenByMembershipId: actor.membershipId } : {}),
        status: "CONSUMED",
        verifiedByMembershipId: actor.membershipId,
      },
    });
    if (consumed.count !== 1) throw new StaffJobOperationError("CREDENTIAL_INVALID");
    const updated = await transaction.job.updateMany({
      where: { businessId: actor.businessId, currentStatus: "READY_FOR_PICKUP", id: verification.job.id },
      data: { currentStatus: "PICKED_UP", version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new StaffJobOperationError("STALE_UPDATE");
    const history = await transaction.jobStatusHistory.create({
      data: {
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        fromStatus: "READY_FOR_PICKUP",
        jobId: verification.job.id,
        reason: manualOverride ? "Pickup confirmed using the controlled management override." : "Pickup credential and physical handover checks were verified.",
        toStatus: "PICKED_UP",
      },
    });
    await transaction.auditLog.create({
      data: {
        action: JOB_OPERATION_AUDIT_ACTIONS.PICKUP_CONFIRMED,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.userId,
        businessId: actor.businessId,
        metadata: { checklist: input.checklist, manualOverride, overrideReason, verificationId: verification.id },
        targetId: verification.job.id,
        targetType: "Job",
      },
    });
    await notifyCustomerOfJobStatus(transaction, {
      businessId: actor.businessId,
      customerUserId: verification.job.customer?.userId ?? null,
      historyId: history.id,
      jobId: verification.job.id,
      publicReference: verification.job.publicReference,
      status: "PICKED_UP",
    });
    await notifyManagementOfPickup(transaction, {
      businessId: actor.businessId,
      pickupVerificationId: verification.id,
      publicReference: verification.job.publicReference,
    });
    return { publicReference: verification.job.publicReference };
  });
}
