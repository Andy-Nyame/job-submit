import "server-only";

export type ServiceOperationErrorCode =
  | "BUSINESS_UNAVAILABLE"
  | "DUPLICATE_SERVICE"
  | "INVALID_PRICE_GUIDANCE"
  | "INVALID_QUANTITY_CONFIGURATION"
  | "INVALID_SPECIFICATION_CONFIGURATION"
  | "NOT_FOUND"
  | "STALE_UPDATE"
  | "VALIDATION";

export class ServiceOperationError extends Error {
  constructor(public readonly code: ServiceOperationErrorCode) {
    super(code);
    this.name = "ServiceOperationError";
  }
}
