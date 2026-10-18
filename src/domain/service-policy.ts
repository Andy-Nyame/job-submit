import type { ApplicationRole } from "./auth-policy";

export const SERVICE_MANAGER_ROLES = ["OWNER", "ADMIN"] as const;
export const SERVICE_AUDIT_ACTIONS = {
  CREATED: "service.created",
  DEACTIVATED: "service.deactivated",
  RESTORED: "service.restored",
  UPDATED: "service.updated",
} as const;
export const MAX_SERVICE_NAME_LENGTH = 160;
export const MAX_SERVICE_DESCRIPTION_LENGTH = 2000;
export const MAX_SERVICE_SORT_ORDER = 10000;

export const SERVICE_COMPLEXITY_OPTIONS = [
  "SIMPLE",
  "MEDIUM",
  "COMPLEX",
] as const;
export const SERVICE_WORKLOAD_OPTIONS = [
  "QUICK",
  "STANDARD",
  "FOCUS",
] as const;

export type ServiceComplexityDefault =
  (typeof SERVICE_COMPLEXITY_OPTIONS)[number];
export type ServiceWorkloadDefault =
  (typeof SERVICE_WORKLOAD_OPTIONS)[number];

export const SERVICE_EDITABLE_FIELDS = [
  "name",
  "description",
  "isActive",
  "onlineSubmissionEnabled",
  "sortOrder",
  "defaultComplexity",
  "defaultWorkloadClass",
  "proofRequiredByDefault",
] as const;

export interface ServiceSettingsInput {
  defaultComplexity: ServiceComplexityDefault | null;
  defaultWorkloadClass: ServiceWorkloadDefault | null;
  description: string;
  isActive: boolean;
  name: string;
  onlineSubmissionEnabled: boolean;
  proofRequiredByDefault: boolean | null;
  sortOrder: number;
}

export interface ValidatedServiceSettings
  extends Omit<ServiceSettingsInput, "description"> {
  description: string | null;
  slug: string;
}

export class ServicePolicyError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CONFIGURATION"
      | "INVALID_DESCRIPTION"
      | "INVALID_NAME"
      | "INVALID_SORT_ORDER"
      | "SERVICE_MANAGER_REQUIRED",
  ) {
    super(code);
    this.name = "ServicePolicyError";
  }
}

export function canManageServices(role: ApplicationRole | null | undefined) {
  return SERVICE_MANAGER_ROLES.some((allowedRole) => allowedRole === role);
}

export function assertCanManageServices(role: ApplicationRole) {
  if (!canManageServices(role)) {
    throw new ServicePolicyError("SERVICE_MANAGER_REQUIRED");
  }
}

export function normalizeServiceName(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > MAX_SERVICE_NAME_LENGTH
  ) {
    throw new ServicePolicyError("INVALID_NAME");
  }
  return normalized;
}

export function serviceSlugFromName(value: string) {
  const normalizedName = normalizeServiceName(value);
  const slug = normalizedName
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");

  if (!slug) {
    throw new ServicePolicyError("INVALID_NAME");
  }
  return slug;
}

export function normalizeServiceDescription(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (normalized.length > MAX_SERVICE_DESCRIPTION_LENGTH) {
    throw new ServicePolicyError("INVALID_DESCRIPTION");
  }
  return normalized || null;
}

function isOneOf<T extends string>(
  value: string | null,
  options: readonly T[],
): value is T | null {
  return value === null || options.some((option) => option === value);
}

export function validateServiceSettings(
  input: ServiceSettingsInput,
): ValidatedServiceSettings {
  if (
    !Number.isSafeInteger(input.sortOrder) ||
    input.sortOrder < 0 ||
    input.sortOrder > MAX_SERVICE_SORT_ORDER
  ) {
    throw new ServicePolicyError("INVALID_SORT_ORDER");
  }
  if (
    !isOneOf(input.defaultComplexity, SERVICE_COMPLEXITY_OPTIONS) ||
    !isOneOf(input.defaultWorkloadClass, SERVICE_WORKLOAD_OPTIONS)
  ) {
    throw new ServicePolicyError("INVALID_CONFIGURATION");
  }

  const name = normalizeServiceName(input.name);
  return {
    ...input,
    description: normalizeServiceDescription(input.description),
    name,
    slug: serviceSlugFromName(name),
  };
}

export function isServicePubliclyEligible(service: {
  archivedAt: Date | null;
  isActive: boolean;
}) {
  return service.isActive && service.archivedAt === null;
}

export function serviceLifecycleAuditAction(active: boolean) {
  return active
    ? SERVICE_AUDIT_ACTIONS.RESTORED
    : SERVICE_AUDIT_ACTIONS.DEACTIVATED;
}

export function canApplyServiceVersion(
  currentVersion: number,
  expectedVersion: number,
) {
  return currentVersion === expectedVersion;
}
