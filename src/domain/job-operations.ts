import type { ApplicationRole } from "./auth-policy";
import { isJobSubmissionSnapshot } from "./job-submission";

export const MANAGEMENT_OPERATION_ROLES = ["ADMIN", "OWNER"] as const;
export const ACTIVE_WORKLOAD_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "PREPARING_FOR_PICKUP",
] as const;
export const MAX_PACKAGE_COUNT = 100;
export const MAX_OPERATION_REASON_LENGTH = 500;

export type ProductionStatus =
  | "ACCEPTED"
  | "QUEUED"
  | "PROCESSING"
  | "PREPARING_FOR_PICKUP"
  | "READY_FOR_PICKUP"
  | "PICKED_UP";

export class JobOperationsPolicyError extends Error {
  constructor(
    public readonly code:
      | "INVALID_PACKAGE_COUNT"
      | "INVALID_REASON"
      | "INVALID_TRANSITION"
      | "MANAGEMENT_REQUIRED"
      | "PRICING_NOT_CONFIRMED",
  ) {
    super(code);
    this.name = "JobOperationsPolicyError";
  }
}

export function canManageOperations(role: ApplicationRole) {
  return MANAGEMENT_OPERATION_ROLES.some((allowed) => allowed === role);
}

export function assertCanManageOperations(role: ApplicationRole) {
  if (!canManageOperations(role)) {
    throw new JobOperationsPolicyError("MANAGEMENT_REQUIRED");
  }
}

export function normalizeOperationReason(value: unknown) {
  if (typeof value !== "string") {
    throw new JobOperationsPolicyError("INVALID_REASON");
  }
  const normalized = value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
  if (
    normalized.length < 5 ||
    normalized.length > MAX_OPERATION_REASON_LENGTH ||
    Array.from(normalized).some((character) => {
      const point = character.codePointAt(0) ?? 0;
      return (point < 32 && character !== "\n" && character !== "\t") || point === 127;
    })
  ) {
    throw new JobOperationsPolicyError("INVALID_REASON");
  }
  return normalized;
}

export function validatePackageCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PACKAGE_COUNT) {
    throw new JobOperationsPolicyError("INVALID_PACKAGE_COUNT");
  }
  return value;
}

export function hasConfirmedOperationalPrice(input: {
  acceptedQuotationExists: boolean;
  submissionSnapshot: unknown;
}) {
  if (!isJobSubmissionSnapshot(input.submissionSnapshot)) return false;
  if (input.submissionSnapshot.pricing.mode === "FIXED") return true;
  return input.acceptedQuotationExists;
}

export function assertProductionTransition(
  from: ProductionStatus,
  to: ProductionStatus,
) {
  const allowed: Partial<Record<ProductionStatus, ProductionStatus>> = {
    ACCEPTED: "QUEUED",
    PROCESSING: "PREPARING_FOR_PICKUP",
    PREPARING_FOR_PICKUP: "READY_FOR_PICKUP",
    QUEUED: "PROCESSING",
    READY_FOR_PICKUP: "PICKED_UP",
  };
  if (allowed[from] !== to) {
    throw new JobOperationsPolicyError("INVALID_TRANSITION");
  }
}

export function queueOrder(input: {
  priority: "EXPRESS" | "REGULAR";
  queueEnteredAt: Date;
  queueOrderTier?: number;
}) {
  return [
    input.priority === "EXPRESS" ? 0 : 1,
    input.queueOrderTier ?? 0,
    input.queueEnteredAt.getTime(),
  ] as const;
}

export function compareQueueJobs(
  left: Parameters<typeof queueOrder>[0],
  right: Parameters<typeof queueOrder>[0],
) {
  const a = queueOrder(left);
  const b = queueOrder(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function pickupChecklistComplete(input: {
  collectorVerified: boolean;
  correctJob: boolean;
  correctSpecifications: boolean;
  packagesPresent: boolean;
}) {
  return Object.values(input).every(Boolean);
}

export const JOB_OPERATION_AUDIT_ACTIONS = {
  ASSIGNED: "job.worker_assigned",
  CLAIMED: "job.worker_claimed",
  PACKAGE_COUNT_UPDATED: "job.package_count_updated",
  PICKUP_CONFIRMED: "job.pickup_confirmed",
  PICKUP_CREDENTIAL_ISSUED: "job.pickup_credential_issued",
  PICKUP_CREDENTIAL_REISSUED: "job.pickup_credential_reissued",
  PRODUCTION_RELEASED: "job.production_released",
  PRODUCTION_STATUS_CHANGED: "job.production_status_changed",
  QUEUE_OVERRIDDEN: "job.queue_overridden",
  REASSIGNED: "job.worker_reassigned",
} as const;
