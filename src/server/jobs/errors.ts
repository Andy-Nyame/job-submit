export type JobOperationErrorCode =
  | "ATTACHMENT_INVALID"
  | "ATTACHMENT_UNAVAILABLE"
  | "ATTACHMENT_USED"
  | "BUSINESS_UNAVAILABLE"
  | "DUPLICATE_SUBMISSION"
  | "SERVICE_UNAVAILABLE"
  | "SHOP_CLOSED"
  | "SUBMISSION_INVALID";

export class JobOperationError extends Error {
  constructor(public readonly code: JobOperationErrorCode) {
    super(code);
    this.name = "JobOperationError";
  }
}
