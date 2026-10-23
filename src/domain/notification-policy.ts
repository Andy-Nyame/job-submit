import type { ApplicationRole } from "./auth-policy";

export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_RECENT_LIMIT = 5;
export const NOTIFICATION_MANAGER_ROLES = ["OWNER", "ADMIN"] as const;

const CUSTOMER_NOTIFICATION_TYPES = [
  "JOB_STATUS_UPDATED",
  "QUOTATION_ISSUED",
  "QUOTATION_REVISED",
  "QUOTATION_WITHDRAWN",
  "QUOTATION_EXPIRED",
  "COUNTEROFFER_DECLINED",
] as const;

const MANAGEMENT_NOTIFICATION_TYPES = [
  "JOB_SUBMITTED",
  "COSTING_REQUIRED",
  "QUOTATION_ACCEPTED",
  "QUOTATION_DECLINED",
  "COUNTEROFFER_SUBMITTED",
] as const;

export type NotificationFilter = "ALL" | "UNREAD";

export interface NotificationListFilters {
  filter: NotificationFilter;
  page: number;
}

export class NotificationPolicyError extends Error {
  constructor(public readonly code: "INVALID_DESTINATION" | "INVALID_FILTER") {
    super(code);
    this.name = "NotificationPolicyError";
  }
}

function single(value: string | string[] | undefined) {
  if (Array.isArray(value)) throw new NotificationPolicyError("INVALID_FILTER");
  return value;
}

export function parseNotificationListFilters(input: {
  filter?: string | string[];
  page?: string | string[];
}): NotificationListFilters {
  const filterValue = single(input.filter)?.trim().toUpperCase() || "ALL";
  const pageValue = single(input.page)?.trim() || "1";
  const page = Number(pageValue);
  if (
    (filterValue !== "ALL" && filterValue !== "UNREAD") ||
    !Number.isSafeInteger(page) ||
    page < 1
  ) {
    throw new NotificationPolicyError("INVALID_FILTER");
  }
  return { filter: filterValue, page };
}

export function canReceiveManagementNotification(role: ApplicationRole) {
  return NOTIFICATION_MANAGER_ROLES.some((allowed) => allowed === role);
}

export function notificationTypesForRole(role: ApplicationRole) {
  if (role === "CUSTOMER") return CUSTOMER_NOTIFICATION_TYPES;
  if (role === "OWNER" || role === "ADMIN") {
    return MANAGEMENT_NOTIFICATION_TYPES;
  }
  return [] as const;
}

export function notificationJobHref(
  audience: "CUSTOMER" | "STAFF",
  publicReference: string,
) {
  if (!/^[A-Z0-9-]{1,32}$/u.test(publicReference)) {
    throw new NotificationPolicyError("INVALID_DESTINATION");
  }
  return audience === "CUSTOMER"
    ? `/app/jobs/${publicReference}`
    : `/app/staff/jobs/${publicReference}`;
}

export function isSafeNotificationHref(value: string | null | undefined) {
  if (!value || !value.startsWith("/app/") || value.startsWith("//")) {
    return false;
  }
  try {
    const base = new URL("https://jobsubmit.invalid");
    const target = new URL(value, base);
    return target.origin === base.origin && !value.includes("\\");
  } catch {
    return false;
  }
}

export function notificationEventKey(
  entity: "counteroffer" | "job" | "quotation",
  id: string,
  action: string,
) {
  const key = `${entity}:${id}:${action}`;
  if (key.length > 180 || !/^[a-z]+:[A-Za-z0-9-]+:[a-z0-9-]+$/u.test(key)) {
    throw new NotificationPolicyError("INVALID_DESTINATION");
  }
  return key;
}
