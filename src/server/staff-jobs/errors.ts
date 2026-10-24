import "server-only";

export type StaffJobOperationErrorCode =
  | "BUSINESS_UNAVAILABLE"
  | "ASSIGNMENT_CONFLICT"
  | "CAPACITY_UNAVAILABLE"
  | "CREDENTIAL_INVALID"
  | "CREDENTIAL_UNAVAILABLE"
  | "INVALID_INPUT"
  | "INVALID_TRANSITION"
  | "MANAGEMENT_REQUIRED"
  | "NOT_FOUND"
  | "PRICING_NOT_CONFIRMED"
  | "WORKER_NOT_ELIGIBLE"
  | "STALE_UPDATE";

export class StaffJobOperationError extends Error {
  constructor(public readonly code: StaffJobOperationErrorCode) {
    super(code);
    this.name = "StaffJobOperationError";
  }
}
