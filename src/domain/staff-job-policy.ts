import type { ApplicationRole } from "./auth-policy";
import { isUuid } from "./job-attachments";

export const STAFF_JOB_ROLES = ["WORKER", "ADMIN", "OWNER"] as const satisfies readonly ApplicationRole[];

export const STAFF_JOB_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "QUEUED",
  "PROCESSING",
  "WAITING_FOR_CUSTOMER",
  "AWAITING_CUSTOMER_APPROVAL",
  "PREPARING_FOR_PICKUP",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "DECLINED",
  "CANCELLED",
] as const;

export const STAFF_JOB_PRIORITIES = ["REGULAR", "EXPRESS"] as const;
export const STAFF_JOB_SORTS = ["NEWEST", "OLDEST", "UPDATED"] as const;
export const STAFF_JOB_WORK_FILTERS = ["AVAILABLE", "MINE"] as const;
export const STAFF_JOB_PRICING_FILTERS = [
  "FIXED_CONFIRMED",
  "AWAITING_COSTING",
  "DRAFT",
  "AWAITING_CUSTOMER",
  "COUNTEROFFER",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
] as const;
export const STAFF_JOB_PAGE_SIZE = 20;
export const MAX_STAFF_JOB_SEARCH_LENGTH = 100;
export const MAX_INTERNAL_NOTE_LENGTH = 2_000;

export type StaffJobStatus = (typeof STAFF_JOB_STATUSES)[number];
export type StaffJobPriority = (typeof STAFF_JOB_PRIORITIES)[number];
export type StaffJobSort = (typeof STAFF_JOB_SORTS)[number];
export type StaffJobPricingFilter = (typeof STAFF_JOB_PRICING_FILTERS)[number];
export type StaffJobWorkFilter = (typeof STAFF_JOB_WORK_FILTERS)[number];

export interface StaffJobInboxFilters {
  page: number;
  priority: StaffJobPriority | null;
  pricing: StaffJobPricingFilter | null;
  query: string;
  serviceId: string | null;
  sort: StaffJobSort;
  status: StaffJobStatus | null;
  work: StaffJobWorkFilter | null;
}

export class StaffJobPolicyError extends Error {
  constructor(
    public readonly code:
      | "INVALID_FILTER"
      | "INVALID_NOTE"
      | "INVALID_TRANSITION"
      | "ROLE_REQUIRED",
  ) {
    super(code);
    this.name = "StaffJobPolicyError";
  }
}

function oneString(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new StaffJobPolicyError("INVALID_FILTER");
  }
  return value;
}

function optionalChoice<const T extends readonly string[]>(
  value: unknown,
  choices: T,
): T[number] | null {
  const normalized = oneString(value).trim().toUpperCase();
  if (!normalized || normalized === "ALL") {
    return null;
  }
  if (!choices.includes(normalized as T[number])) {
    throw new StaffJobPolicyError("INVALID_FILTER");
  }
  return normalized as T[number];
}

function hasUnsafeControls(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      (codePoint < 32 && character !== "\n" && character !== "\t") ||
      codePoint === 127
    );
  });
}

export function canManageStaffJobs(role: ApplicationRole | null) {
  return role !== null && STAFF_JOB_ROLES.includes(role as (typeof STAFF_JOB_ROLES)[number]);
}

export function assertCanManageStaffJobs(role: ApplicationRole) {
  if (!canManageStaffJobs(role)) {
    throw new StaffJobPolicyError("ROLE_REQUIRED");
  }
}

export function normalizeStaffJobSearch(value: unknown) {
  const normalized = oneString(value).normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (normalized.length > MAX_STAFF_JOB_SEARCH_LENGTH || hasUnsafeControls(normalized)) {
    throw new StaffJobPolicyError("INVALID_FILTER");
  }
  return normalized;
}

export function parseStaffJobInboxFilters(input: Record<string, unknown>): StaffJobInboxFilters {
  const pageValue = oneString(input.page).trim();
  const page = pageValue ? Number(pageValue) : 1;
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) {
    throw new StaffJobPolicyError("INVALID_FILTER");
  }

  const serviceValue = oneString(input.service).trim();
  if (serviceValue && !isUuid(serviceValue)) {
    throw new StaffJobPolicyError("INVALID_FILTER");
  }

  const sortValue = oneString(input.sort).trim().toUpperCase() || "NEWEST";
  if (!STAFF_JOB_SORTS.includes(sortValue as StaffJobSort)) {
    throw new StaffJobPolicyError("INVALID_FILTER");
  }

  return {
    page,
    priority: optionalChoice(input.priority, STAFF_JOB_PRIORITIES),
    pricing: optionalChoice(input.pricing, STAFF_JOB_PRICING_FILTERS),
    query: normalizeStaffJobSearch(input.q),
    serviceId: serviceValue || null,
    sort: sortValue as StaffJobSort,
    status: optionalChoice(input.status, STAFF_JOB_STATUSES),
    work: optionalChoice(input.work, STAFF_JOB_WORK_FILTERS),
  };
}

export function assertStaffJobTransition(
  fromStatus: StaffJobStatus,
  toStatus: StaffJobStatus,
) {
  if (fromStatus !== "SUBMITTED" || toStatus !== "UNDER_REVIEW") {
    throw new StaffJobPolicyError("INVALID_TRANSITION");
  }
}

export function normalizeInternalNote(value: unknown) {
  if (typeof value !== "string") {
    throw new StaffJobPolicyError("INVALID_NOTE");
  }
  const normalized = value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
  if (!normalized || normalized.length > MAX_INTERNAL_NOTE_LENGTH || hasUnsafeControls(normalized)) {
    throw new StaffJobPolicyError("INVALID_NOTE");
  }
  return normalized;
}

export const STAFF_JOB_AUDIT_ACTIONS = {
  NOTE_ADDED: "job.internal_note_added",
  REVIEW_STARTED: "job.review_started",
} as const;
