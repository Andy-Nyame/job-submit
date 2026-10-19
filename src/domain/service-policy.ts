import type { ApplicationRole } from "./auth-policy";
import {
  type IndicativePriceInput,
  type QuantityConfigurationInput,
  ServiceConfigurationError,
  type ServiceQuantityConfiguration,
  type ServiceSpecificationConfiguration,
  type SpecificationConfigurationInput,
  validateIndicativePrice,
  validateQuantityConfiguration,
  validateSpecificationConfiguration,
} from "./service-configuration";

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
export const SERVICE_SORT_ORDER_STEP = 10;

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
  "quantityConfiguration",
  "specificationConfiguration",
  "indicativePriceMinMinor",
  "indicativePriceMaxMinor",
  "indicativePriceDescription",
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
  price: IndicativePriceInput;
  proofRequiredByDefault: boolean | null;
  quantity: QuantityConfigurationInput;
  specification: SpecificationConfigurationInput;
}

export interface ValidatedServiceSettings extends Omit<
  ServiceSettingsInput,
  "description" | "price" | "quantity" | "specification"
> {
  description: string | null;
  indicativePriceDescription: string | null;
  indicativePriceMaxMinor: bigint | null;
  indicativePriceMinMinor: bigint | null;
  quantityConfiguration: ServiceQuantityConfiguration | null;
  slug: string;
  specificationConfiguration: ServiceSpecificationConfiguration | null;
}

export class ServicePolicyError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CONFIGURATION"
      | "INVALID_DESCRIPTION"
      | "INVALID_NAME"
      | "INVALID_PRICE_GUIDANCE"
      | "INVALID_QUANTITY_CONFIGURATION"
      | "INVALID_SPECIFICATION_CONFIGURATION"
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
    !isOneOf(input.defaultComplexity, SERVICE_COMPLEXITY_OPTIONS) ||
    !isOneOf(input.defaultWorkloadClass, SERVICE_WORKLOAD_OPTIONS)
  ) {
    throw new ServicePolicyError("INVALID_CONFIGURATION");
  }

  const name = normalizeServiceName(input.name);
  let quantityConfiguration: ServiceQuantityConfiguration | null;
  let specificationConfiguration: ServiceSpecificationConfiguration | null;
  let price: ReturnType<typeof validateIndicativePrice>;
  try {
    quantityConfiguration = validateQuantityConfiguration(input.quantity);
    specificationConfiguration = validateSpecificationConfiguration(
      input.specification,
    );
    price = validateIndicativePrice(input.price);
  } catch (error) {
    if (error instanceof ServiceConfigurationError) {
      throw new ServicePolicyError(error.code);
    }
    throw error;
  }

  return {
    defaultComplexity: input.defaultComplexity,
    defaultWorkloadClass: input.defaultWorkloadClass,
    description: normalizeServiceDescription(input.description),
    indicativePriceDescription: price.description,
    indicativePriceMaxMinor: price.maximumMinor,
    indicativePriceMinMinor: price.minimumMinor,
    isActive: input.isActive,
    name,
    onlineSubmissionEnabled: input.onlineSubmissionEnabled,
    proofRequiredByDefault: input.proofRequiredByDefault,
    quantityConfiguration,
    slug: serviceSlugFromName(name),
    specificationConfiguration,
  };
}

export function nextServiceSortOrder(existingOrders: readonly number[]) {
  const validOrders = existingOrders.filter(
    (order) => Number.isSafeInteger(order) && order >= 0 && order <= MAX_SERVICE_SORT_ORDER,
  );
  const highest = validOrders.length === 0 ? 0 : Math.max(...validOrders);
  if (highest + SERVICE_SORT_ORDER_STEP <= MAX_SERVICE_SORT_ORDER) {
    return highest + SERVICE_SORT_ORDER_STEP;
  }

  const used = new Set(validOrders);
  for (let order = 0; order <= MAX_SERVICE_SORT_ORDER; order += 1) {
    if (!used.has(order)) {
      return order;
    }
  }
  throw new ServicePolicyError("INVALID_CONFIGURATION");
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
