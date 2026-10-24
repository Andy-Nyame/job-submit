import "server-only";

export type ShopOperationErrorCode =
  | "BUSINESS_UNAVAILABLE"
  | "STALE_UPDATE";

export class ShopOperationError extends Error {
  constructor(public readonly code: ShopOperationErrorCode) {
    super(code);
    this.name = "ShopOperationError";
  }
}
