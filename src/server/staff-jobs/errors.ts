import "server-only";

export type StaffJobOperationErrorCode =
  | "BUSINESS_UNAVAILABLE"
  | "INVALID_INPUT"
  | "INVALID_TRANSITION"
  | "NOT_FOUND"
  | "STALE_UPDATE";

export class StaffJobOperationError extends Error {
  constructor(public readonly code: StaffJobOperationErrorCode) {
    super(code);
    this.name = "StaffJobOperationError";
  }
}
