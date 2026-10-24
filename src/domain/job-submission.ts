import type { ApplicationRole } from "./auth-policy";
import {
  isQuantityAllowed,
  MAX_LONG_TEXT_LENGTH,
  readQuantityConfiguration,
  readSpecificationConfiguration,
  validateCustomerFieldValues,
  validateVariationOrder,
  type DimensionUnit,
} from "./service-configuration";
import {
  calculateFixedPrice,
  readPricingConfiguration,
} from "./service-pricing";
import {
  calculateStrategyPrice,
  readStrategyPricingConfiguration,
} from "./service-pricing-strategies";
import { calculateExpressPrice } from "./job-rules";
import {
  isUuid,
  MAX_JOB_ATTACHMENTS,
  normalizeOriginalFilename,
  validateCustomerUploadPath,
  type CustomerUploadReference,
} from "./job-attachments";

export const JOB_SUBMISSION_SNAPSHOT_VERSION = 1 as const;
export const MAX_JOB_TITLE_LENGTH = 200;
export const MAX_JOB_INSTRUCTIONS_LENGTH = 4_000;
export const CUSTOMER_JOB_ROLES = ["CUSTOMER"] as const satisfies readonly ApplicationRole[];

const workloadForComplexity = {
  COMPLEX: "FOCUS",
  MEDIUM: "STANDARD",
  SIMPLE: "QUICK",
} as const;

export interface SubmissionService {
  defaultComplexity: "COMPLEX" | "MEDIUM" | "SIMPLE" | null;
  defaultWorkloadClass: "FOCUS" | "QUICK" | "STANDARD" | null;
  description: string | null;
  id: string;
  isActive: boolean;
  name: string;
  onlineSubmissionEnabled: boolean;
  pricingConfiguration: unknown;
  quantityConfiguration: unknown;
  slug: string;
  specificationConfiguration: unknown;
  version: number;
}

export interface JobSubmissionPayload {
  attachments: CustomerUploadReference[];
  idempotencyKey: string;
  linkedDesignServiceId?: string;
  instructions: string;
  priority: "EXPRESS" | "REGULAR";
  quantity: string;
  selection: {
    finishing: string;
    jobFields: Record<string, string>;
    material: string;
    size: {
      height: string;
      kind: "CUSTOM" | "FIXED" | "NONE" | "PRESET";
      option: string;
      unit: string;
      width: string;
    };
    variations: {
      fieldValues: Record<string, string>;
      id: string;
      quantity: number;
    }[];
  };
  serviceId: string;
  title: string;
}

export type SubmissionPricingSnapshot =
  | {
      basePriceMinor: string;
      calculation?: Record<string, number | string>;
      configuredMode: "FIXED";
      coverage: string;
      currency: "GHS";
      expressSurchargeBasisPoints: number;
      expressSurchargeMinor: string;
      mode: "FIXED";
      quotePending: false;
      totalMinor: string;
    }
  | {
      configuredMode: "FIXED" | "ON_REQUEST";
      currency: "GHS";
      expressSurchargeBasisPoints: number;
      mode: "ON_REQUEST";
      quotePending: true;
      reason: "FIXED_RULE_NOT_APPLICABLE" | "SERVICE_PRICED_AFTER_REVIEW";
    };

export interface JobSubmissionSnapshot {
  pricing: SubmissionPricingSnapshot;
  request: {
    finishing: string | null;
    instructions: string;
    jobFields: Record<string, string>;
    material: string | null;
    priority: "EXPRESS" | "REGULAR";
    quantity: number | null;
    size:
      | { kind: "NONE" }
      | { height: string; kind: "FIXED"; unit: DimensionUnit; width: string }
      | { kind: "PRESET"; option: string }
      | { height: string; kind: "CUSTOM"; unit: DimensionUnit; width: string };
    title: string;
    variations: {
      fieldValues: Record<string, string>;
      id: string;
      quantity: number;
    }[];
  };
  service: {
    description: string | null;
    id: string;
    name: string;
    pricingConfiguration: unknown;
    quantityConfiguration: unknown;
    slug: string;
    specificationConfiguration: unknown;
    version: number;
  };
  version: typeof JOB_SUBMISSION_SNAPSHOT_VERSION;
}

export class JobSubmissionValidationError extends Error {
  constructor(
    public readonly code:
      | "ATTACHMENTS"
      | "CUSTOM_FIELDS"
      | "DIMENSIONS"
      | "FINISHING"
      | "IDEMPOTENCY_KEY"
      | "INSTRUCTIONS"
      | "MALFORMED_PAYLOAD"
      | "MATERIAL"
      | "PRIORITY"
      | "QUANTITY"
      | "SERVICE_CONFIGURATION"
      | "SERVICE_UNAVAILABLE"
      | "SIZE"
      | "TAMPERED_PRICE"
      | "TITLE"
      | "VARIATIONS",
  ) {
    super(code);
    this.name = "JobSubmissionValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function containsPricingKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsPricingKey);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(([key, child]) =>
    /(?:price|amount|subtotal|totalMinor|surchargeMinor)/iu.test(key)
      ? true
      : containsPricingKey(child),
  );
}

function normalizeTitle(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const unsafe = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === "<" || character === ">" || codePoint < 32 || codePoint === 127;
  });
  if (normalized.length < 2 || normalized.length > MAX_JOB_TITLE_LENGTH || unsafe) {
    throw new JobSubmissionValidationError("TITLE");
  }
  return normalized;
}

function normalizeInstructions(value: string) {
  const normalized = value.normalize("NFKC").trim();
  const unsafe = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === "<" || character === ">" || (codePoint < 32 && character !== "\n" && character !== "\r" && character !== "\t") || codePoint === 127;
  });
  if (normalized.length > MAX_JOB_INSTRUCTIONS_LENGTH || unsafe) {
    throw new JobSubmissionValidationError("INSTRUCTIONS");
  }
  return normalized;
}

function parseDimension(value: string) {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/u.test(normalized)) {
    throw new JobSubmissionValidationError("DIMENSIONS");
  }
  const numeric = Number(normalized);
  if (numeric <= 0 || numeric > 100_000) {
    throw new JobSubmissionValidationError("DIMENSIONS");
  }
  return normalized;
}

function validatePayloadShape(payload: unknown): asserts payload is JobSubmissionPayload {
  if (!isRecord(payload)) {
    throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
  }
  if (containsPricingKey(payload)) {
    throw new JobSubmissionValidationError("TAMPERED_PRICE");
  }
  if (!hasOnlyKeys(payload, ["attachments", "idempotencyKey", "instructions", "linkedDesignServiceId", "priority", "quantity", "selection", "serviceId", "title"])) {
    throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
  }
  if (
    typeof payload.idempotencyKey !== "string" ||
    typeof payload.instructions !== "string" ||
    typeof payload.priority !== "string" ||
    typeof payload.quantity !== "string" ||
    typeof payload.serviceId !== "string" ||
    typeof payload.title !== "string" ||
    !Array.isArray(payload.attachments) ||
    !isRecord(payload.selection)
  ) {
    throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
  }
  if (payload.linkedDesignServiceId !== undefined && typeof payload.linkedDesignServiceId !== "string") {
    throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
  }
  const selection = payload.selection;
  if (
    !hasOnlyKeys(selection, ["finishing", "jobFields", "material", "size", "variations"]) ||
    typeof selection.finishing !== "string" ||
    !isRecord(selection.jobFields) ||
    typeof selection.material !== "string" ||
    !isRecord(selection.size) ||
    !Array.isArray(selection.variations) ||
    Object.values(selection.jobFields).some((value) => typeof value !== "string")
  ) {
    throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
  }
  if (!hasOnlyKeys(selection.size, ["height", "kind", "option", "unit", "width"])) {
    throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
  }
  for (const value of [selection.size.height, selection.size.kind, selection.size.option, selection.size.unit, selection.size.width]) {
    if (typeof value !== "string") {
      throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
    }
  }
  for (const variation of selection.variations) {
    if (
      !isRecord(variation) ||
      !hasOnlyKeys(variation, ["fieldValues", "id", "quantity"]) ||
      !isRecord(variation.fieldValues) ||
      typeof variation.id !== "string" ||
      typeof variation.quantity !== "number" ||
      Object.values(variation.fieldValues).some((value) => typeof value !== "string")
    ) {
      throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
    }
  }
  for (const attachment of payload.attachments) {
    if (
      !isRecord(attachment) ||
      !hasOnlyKeys(attachment, ["originalFilename", "pathname", "uploadId"]) ||
      typeof attachment.originalFilename !== "string" ||
      typeof attachment.pathname !== "string" ||
      typeof attachment.uploadId !== "string"
    ) {
      throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
    }
  }
}

function validateChoice(value: string, options: readonly string[], required: boolean, code: "FINISHING" | "MATERIAL") {
  if (!value) {
    if (required) {
      throw new JobSubmissionValidationError(code);
    }
    return null;
  }
  if (!options.includes(value)) {
    throw new JobSubmissionValidationError(code);
  }
  return value;
}

export function assertCanSubmitCustomerJob(role: ApplicationRole) {
  if (!CUSTOMER_JOB_ROLES.includes(role as "CUSTOMER")) {
    throw new JobSubmissionValidationError("SERVICE_UNAVAILABLE");
  }
}

export function validateJobSubmission(
  untrustedPayload: unknown,
  service: SubmissionService,
) {
  validatePayloadShape(untrustedPayload);
  const payload = untrustedPayload;
  if (!isUuid(payload.idempotencyKey)) {
    throw new JobSubmissionValidationError("IDEMPOTENCY_KEY");
  }
  if (!isUuid(payload.serviceId) || payload.serviceId !== service.id) {
    throw new JobSubmissionValidationError("SERVICE_UNAVAILABLE");
  }
  if (!service.isActive || !service.onlineSubmissionEnabled) {
    throw new JobSubmissionValidationError("SERVICE_UNAVAILABLE");
  }
  if (payload.priority !== "REGULAR" && payload.priority !== "EXPRESS") {
    throw new JobSubmissionValidationError("PRIORITY");
  }
  if (payload.attachments.length > MAX_JOB_ATTACHMENTS) {
    throw new JobSubmissionValidationError("ATTACHMENTS");
  }
  const attachments = payload.attachments.map((attachment) => {
    try {
      return {
        originalFilename: normalizeOriginalFilename(attachment.originalFilename),
        pathname: validateCustomerUploadPath(attachment.uploadId, attachment.pathname),
        uploadId: attachment.uploadId,
      };
    } catch {
      throw new JobSubmissionValidationError("ATTACHMENTS");
    }
  });
  if (new Set(attachments.map((attachment) => attachment.uploadId)).size !== attachments.length) {
    throw new JobSubmissionValidationError("ATTACHMENTS");
  }

  const title = normalizeTitle(payload.title);
  const instructions = normalizeInstructions(payload.instructions);
  const quantityConfiguration = readQuantityConfiguration(service.quantityConfiguration);
  const specification = readSpecificationConfiguration(service.specificationConfiguration);
  const pricingConfiguration = readPricingConfiguration(service.pricingConfiguration);

  if (
    specification?.artworkRequirement === "CUSTOMER_PROVIDED" &&
    attachments.length === 0 &&
    !payload.linkedDesignServiceId
  ) {
    throw new JobSubmissionValidationError("ATTACHMENTS");
  }

  let quantity: number | null = null;
  let variations: JobSubmissionSnapshot["request"]["variations"] = [];
  let hasMixedSpecifications = false;
  const rawQuantity = payload.quantity.trim();
  if (payload.selection.variations.length > 0) {
    if (!specification?.variations.enabled) {
      throw new JobSubmissionValidationError("VARIATIONS");
    }
    try {
      const result = validateVariationOrder(
        quantityConfiguration,
        specification,
        payload.selection.variations.map((variation) => ({
          ...variation,
          specificationKey: null,
        })),
      );
      quantity = result.totalQuantity;
      variations = result.variations.map(({ fieldValues, id, quantity: itemQuantity }) => ({
        fieldValues,
        id,
        quantity: itemQuantity,
      }));
      hasMixedSpecifications = result.hasMixedSpecifications;
    } catch {
      throw new JobSubmissionValidationError("VARIATIONS");
    }
  } else if (rawQuantity) {
    if (!/^\d+$/u.test(rawQuantity)) {
      throw new JobSubmissionValidationError("QUANTITY");
    }
    quantity = Number(rawQuantity);
    if (!isQuantityAllowed(quantity, quantityConfiguration)) {
      throw new JobSubmissionValidationError("QUANTITY");
    }
  } else if (quantityConfiguration || pricingConfiguration.mode === "FIXED") {
    throw new JobSubmissionValidationError("QUANTITY");
  }

  if (
    specification?.variations.enabled &&
    variations.length === 0 &&
    specification.customerFields.some((field) => field.scope === "VARIATION" && field.required)
  ) {
    throw new JobSubmissionValidationError("VARIATIONS");
  }

  let jobFields = (() => {
    try {
      return validateCustomerFieldValues(
        specification?.customerFields ?? [],
        "JOB",
        payload.selection.jobFields,
      );
    } catch {
      throw new JobSubmissionValidationError("CUSTOM_FIELDS");
    }
  })();

  const strategyConfiguration = readStrategyPricingConfiguration(
    service.pricingConfiguration,
  );
  if (strategyConfiguration?.profile === "CONTAINER_NUMBER") {
    const number = jobFields["container-number"]?.trim().toUpperCase() ?? "";
    if (!/^[A-Z]\d{3}$/u.test(number)) {
      throw new JobSubmissionValidationError("CUSTOM_FIELDS");
    }
    jobFields = { ...jobFields, "container-number": number };
  }

  const material = validateChoice(
    payload.selection.material,
    specification?.materials.options ?? [],
    specification?.materials.required ?? false,
    "MATERIAL",
  );
  const finishing = validateChoice(
    payload.selection.finishing,
    specification?.finishing.options ?? [],
    specification?.finishing.required ?? false,
    "FINISHING",
  );

  const configuredSize = specification?.sizes ?? {
    customUnits: [] as DimensionUnit[],
    fixed: null,
    mode: "NO_SIZE" as const,
    options: [] as string[],
  };
  const suppliedSize = payload.selection.size;
  let size: JobSubmissionSnapshot["request"]["size"];
  if (configuredSize.mode === "NO_SIZE") {
    if (suppliedSize.kind !== "NONE") {
      throw new JobSubmissionValidationError("SIZE");
    }
    size = { kind: "NONE" };
  } else if (configuredSize.mode === "FIXED" && configuredSize.fixed) {
    if (suppliedSize.kind !== "FIXED") {
      throw new JobSubmissionValidationError("SIZE");
    }
    size = { ...configuredSize.fixed, kind: "FIXED" };
  } else if (suppliedSize.kind === "PRESET") {
    if (
      (configuredSize.mode !== "PRESET" && configuredSize.mode !== "PRESET_OR_CUSTOM") ||
      !configuredSize.options.includes(suppliedSize.option)
    ) {
      throw new JobSubmissionValidationError("SIZE");
    }
    size = { kind: "PRESET", option: suppliedSize.option };
  } else if (suppliedSize.kind === "CUSTOM") {
    if (
      (configuredSize.mode !== "CUSTOM" && configuredSize.mode !== "PRESET_OR_CUSTOM") ||
      !configuredSize.customUnits.includes(suppliedSize.unit as DimensionUnit)
    ) {
      throw new JobSubmissionValidationError("DIMENSIONS");
    }
    size = {
      height: parseDimension(suppliedSize.height),
      kind: "CUSTOM",
      unit: suppliedSize.unit as DimensionUnit,
      width: parseDimension(suppliedSize.width),
    };
  } else {
    throw new JobSubmissionValidationError("SIZE");
  }

  const strategyPrice = quantity === null || !strategyConfiguration
    ? null
    : calculateStrategyPrice(strategyConfiguration, {
        jobFields,
        quantity,
        size,
      });
  if (strategyConfiguration && !strategyPrice) {
    const irregularLabel =
      jobFields["sticker-product"] === "Labels" &&
      jobFields["label-shape"] === "Custom / irregular";
    const missingLabelShape =
      jobFields["sticker-product"] === "Labels" &&
      !jobFields["label-shape"];
    if (!irregularLabel) {
      throw new JobSubmissionValidationError(
        strategyConfiguration.profile === "CONTAINER_NUMBER" || missingLabelShape
          ? "CUSTOM_FIELDS"
          : "QUANTITY",
      );
    }
  }
  const basePrice = quantity === null
    ? null
    : strategyPrice?.basePriceMinor ?? calculateFixedPrice(pricingConfiguration, quantityConfiguration, {
        hasMixedSpecifications,
        totalQuantity: quantity,
      });
  let pricing: SubmissionPricingSnapshot;
  if (pricingConfiguration.mode === "FIXED" && basePrice !== null) {
    const calculated = payload.priority === "EXPRESS"
      ? calculateExpressPrice(basePrice)
      : {
          basePriceMinor: basePrice,
          surchargeBasisPoints: 0n,
          surchargeMinor: 0n,
          totalMinor: basePrice,
        };
    pricing = {
      basePriceMinor: calculated.basePriceMinor.toString(),
      ...(strategyPrice ? { calculation: strategyPrice.internalCalculation } : {}),
      configuredMode: "FIXED",
      coverage: strategyPrice?.coverage ?? pricingConfiguration.fixed?.coverage ?? "Configured service requirements",
      currency: "GHS",
      expressSurchargeBasisPoints: Number(calculated.surchargeBasisPoints),
      expressSurchargeMinor: calculated.surchargeMinor.toString(),
      mode: "FIXED",
      quotePending: false,
      totalMinor: calculated.totalMinor.toString(),
    };
  } else {
    pricing = {
      configuredMode: pricingConfiguration.mode,
      currency: "GHS",
      expressSurchargeBasisPoints: payload.priority === "EXPRESS" ? 4_000 : 0,
      mode: "ON_REQUEST",
      quotePending: true,
      reason:
        pricingConfiguration.mode === "FIXED"
          ? "FIXED_RULE_NOT_APPLICABLE"
          : "SERVICE_PRICED_AFTER_REVIEW",
    };
  }

  const expectedWorkload = service.defaultComplexity
    ? workloadForComplexity[service.defaultComplexity]
    : null;
  if (service.defaultWorkloadClass !== expectedWorkload) {
    throw new JobSubmissionValidationError("SERVICE_CONFIGURATION");
  }

  const snapshot: JobSubmissionSnapshot = {
    pricing,
    request: {
      finishing,
      instructions,
      jobFields,
      material,
      priority: payload.priority,
      quantity,
      size,
      title,
      variations,
    },
    service: {
      description: service.description,
      id: service.id,
      name: service.name,
      pricingConfiguration,
      quantityConfiguration,
      slug: service.slug,
      specificationConfiguration: specification,
      version: service.version,
    },
    version: JOB_SUBMISSION_SNAPSHOT_VERSION,
  };

  return {
    attachments,
    complexity: service.defaultComplexity,
    instructions,
    priority: payload.priority,
    quantity,
    snapshot,
    title,
    workloadClass: service.defaultWorkloadClass,
  };
}

export function parseJobSubmissionPayload(value: string) {
  if (value.length > MAX_LONG_TEXT_LENGTH * 20) {
    throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
  }
  try {
    const parsed: unknown = JSON.parse(value);
    validatePayloadShape(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof JobSubmissionValidationError) {
      throw error;
    }
    throw new JobSubmissionValidationError("MALFORMED_PAYLOAD");
  }
}

export function isJobSubmissionSnapshot(value: unknown): value is JobSubmissionSnapshot {
  return (
    isRecord(value) &&
    value.version === JOB_SUBMISSION_SNAPSHOT_VERSION &&
    isRecord(value.service) &&
    isRecord(value.request) &&
    isRecord(value.pricing)
  );
}
