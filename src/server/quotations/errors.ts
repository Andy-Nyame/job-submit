import "server-only";

export type QuotationOperationErrorCode =
  | "BUSINESS_UNAVAILABLE"
  | "COUNTEROFFER_NOT_ALLOWED"
  | "DUPLICATE_OPERATION"
  | "EXPIRED"
  | "FIXED_PRICE_JOB"
  | "INVALID_INPUT"
  | "INVALID_TRANSITION"
  | "NOT_FOUND"
  | "STALE_UPDATE";

export class QuotationOperationError extends Error {
  constructor(public readonly code: QuotationOperationErrorCode) {
    super(code);
    this.name = "QuotationOperationError";
  }
}
