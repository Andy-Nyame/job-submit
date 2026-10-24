import type { ApplicationRole } from "./auth-policy";

export const SHOP_MANAGER_ROLES = ["OWNER", "ADMIN"] as const;

export class ShopPolicyError extends Error {
  constructor(public readonly code: "SHOP_MANAGER_REQUIRED") {
    super(code);
    this.name = "ShopPolicyError";
  }
}

export function canManageShop(role: ApplicationRole | null | undefined) {
  return SHOP_MANAGER_ROLES.some((allowedRole) => allowedRole === role);
}

export function assertCanManageShop(role: ApplicationRole) {
  if (!canManageShop(role)) {
    throw new ShopPolicyError("SHOP_MANAGER_REQUIRED");
  }
}

export function defaultApplicationRoute(role: ApplicationRole) {
  return role === "CUSTOMER" ? "/app/jobs/new" : "/app/staff/jobs";
}

export function shopAuditAction(acceptingNewJobs: boolean) {
  return acceptingNewJobs ? "business.shop_opened" : "business.shop_closed";
}
