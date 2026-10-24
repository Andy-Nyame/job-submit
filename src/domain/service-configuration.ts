export const QUANTITY_CONFIGURATION_VERSION = 1 as const;
export const SPECIFICATION_CONFIGURATION_VERSION = 2 as const;
const LEGACY_SPECIFICATION_CONFIGURATION_VERSION = 1 as const;

export const MAX_SERVICE_QUANTITY = 1_000_000;
export const MAX_QUANTITY_PRESETS = 20;
export const MAX_QUANTITY_UNIT_LENGTH = 32;
export const MAX_SPECIFICATION_OPTIONS = 20;
export const MAX_SPECIFICATION_OPTION_LENGTH = 80;
export const MAX_SERVICE_INSTRUCTIONS_LENGTH = 500;
export const MAX_CUSTOM_FIELDS = 16;
export const MAX_CUSTOM_FIELD_LABEL_LENGTH = 80;
export const MAX_CUSTOM_FIELD_HELP_LENGTH = 200;
export const MAX_CUSTOM_FIELD_OPTIONS = 20;
export const MAX_SHORT_TEXT_LENGTH = 160;
export const MAX_LONG_TEXT_LENGTH = 2_000;
export const MAX_VARIATIONS = 50;
export const MAX_DIMENSION_VALUE = 100_000;

export const ARTWORK_REQUIREMENTS = [
  "CUSTOMER_PROVIDED",
  "BUSINESS_DESIGN",
  "EITHER",
  "NOT_REQUIRED",
] as const;
export const DIMENSION_UNITS = ["MM", "CM", "INCHES", "FEET", "METERS"] as const;
export const SIZE_MODES = [
  "NO_SIZE",
  "FIXED",
  "PRESET",
  "CUSTOM",
  "PRESET_OR_CUSTOM",
] as const;
export const CUSTOMER_FIELD_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "SELECTION",
] as const;
export const CUSTOMER_FIELD_SCOPES = ["JOB", "VARIATION"] as const;

export type ArtworkRequirement = (typeof ARTWORK_REQUIREMENTS)[number];
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];
export type SizeMode = (typeof SIZE_MODES)[number];
export type CustomerFieldType = (typeof CUSTOMER_FIELD_TYPES)[number];
export type CustomerFieldScope = (typeof CUSTOMER_FIELD_SCOPES)[number];

export interface QuantityConfigurationInput {
  increment: string;
  maximum: string;
  minimum: string;
  presets: string;
  unit: string;
}

export interface ServiceQuantityConfiguration {
  increment: number | null;
  maximum: number | null;
  minimum: number | null;
  presets: number[];
  unit: string;
  version: typeof QUANTITY_CONFIGURATION_VERSION;
}

export interface CustomerFieldConfigurationInput {
  helpText: string;
  id: string;
  label: string;
  maxLength: string;
  options: string;
  required: boolean;
  scope: string;
  type: string;
}

export interface CustomerFieldConfiguration {
  helpText: string | null;
  id: string;
  label: string;
  maxLength: number | null;
  options: string[];
  required: boolean;
  scope: CustomerFieldScope;
  type: CustomerFieldType;
}

export interface SpecificationConfigurationInput {
  artworkRequirement: string;
  customDimensionUnits: string[];
  customFields: CustomerFieldConfigurationInput[];
  customInstructions: string;
  finishingOptions: string;
  finishingRequired: boolean;
  fixedSizeHeight: string;
  fixedSizeUnit: string;
  fixedSizeWidth: string;
  materialOptions: string;
  materialsRequired: boolean;
  sizeMode: string;
  standardSizeOptions: string;
  variationsEnabled: boolean;
}

export interface ServiceSpecificationConfiguration {
  artworkRequirement: ArtworkRequirement | null;
  customerFields: CustomerFieldConfiguration[];
  customInstructions: string | null;
  finishing: {
    options: string[];
    required: boolean;
  };
  materials: {
    options: string[];
    required: boolean;
  };
  sizes: {
    customUnits: DimensionUnit[];
    fixed: {
      height: string;
      unit: DimensionUnit;
      width: string;
    } | null;
    mode: SizeMode;
    options: string[];
  };
  variations: {
    enabled: boolean;
    maxItems: typeof MAX_VARIATIONS;
  };
  version: typeof SPECIFICATION_CONFIGURATION_VERSION;
}

export interface FutureVariationInput {
  fieldValues: Record<string, string>;
  id: string;
  quantity: number;
  specificationKey?: string | null;
}

export interface ValidatedVariationOrder {
  hasMixedSpecifications: boolean;
  totalQuantity: number;
  variations: FutureVariationInput[];
}

export type ServiceConfigurationErrorCode =
  | "INVALID_CUSTOMER_FIELD_VALUES"
  | "INVALID_QUANTITY_CONFIGURATION"
  | "INVALID_SPECIFICATION_CONFIGURATION"
  | "INVALID_VARIATIONS";

export class ServiceConfigurationError extends Error {
  constructor(public readonly code: ServiceConfigurationErrorCode) {
    super(code);
    this.name = "ServiceConfigurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includesValue<T extends string>(
  value: string,
  values: readonly T[],
): value is T {
  return values.some((candidate) => candidate === value);
}

function hasUnsafePlainText(value: string, allowLineBreaks = false) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === "<" || character === ">" || codePoint === 127) {
      return true;
    }
    if (allowLineBreaks && (character === "\n" || character === "\r")) {
      return false;
    }
    return codePoint < 32;
  });
}

function normalizeSingleLine(value: string, maximumLength: number) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (
    normalized.length > maximumLength ||
    hasUnsafePlainText(normalized)
  ) {
    return null;
  }
  return normalized;
}

function parseOptionalPositiveInteger(value: string, maximum = MAX_SERVICE_QUANTITY) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (!/^\d+$/u.test(normalized)) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    return undefined;
  }
  return parsed;
}

function parseOptions(value: string, maximum = MAX_SPECIFICATION_OPTIONS) {
  const rawOptions = value
    .split(/\r?\n/u)
    .map((option) => normalizeSingleLine(option, MAX_SPECIFICATION_OPTION_LENGTH))
    .filter((option) => option !== "");
  if (rawOptions.length > maximum || rawOptions.some((option) => option === null)) {
    return null;
  }
  const options = rawOptions as string[];
  const keys = options.map((option) => option.toLocaleLowerCase("en"));
  return new Set(keys).size === keys.length ? options : null;
}

function parseDimension(value: string) {
  const normalized = value.trim();
  const match = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/u.exec(normalized);
  if (!match || Number(normalized) <= 0 || Number(normalized) > MAX_DIMENSION_VALUE) {
    return null;
  }
  return normalized;
}

export function isQuantityAllowed(
  quantity: number,
  configuration: ServiceQuantityConfiguration | null,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_SERVICE_QUANTITY) {
    return false;
  }
  if (!configuration) {
    return true;
  }
  if (
    (configuration.minimum !== null && quantity < configuration.minimum) ||
    (configuration.maximum !== null && quantity > configuration.maximum)
  ) {
    return false;
  }
  if (configuration.increment !== null) {
    const baseline = configuration.minimum ?? configuration.increment;
    if (quantity < baseline || (quantity - baseline) % configuration.increment !== 0) {
      return false;
    }
  }
  return true;
}

export function validateQuantityConfiguration(
  input: QuantityConfigurationInput,
): ServiceQuantityConfiguration | null {
  const unit = normalizeSingleLine(input.unit, MAX_QUANTITY_UNIT_LENGTH);
  const minimum = parseOptionalPositiveInteger(input.minimum);
  const maximum = parseOptionalPositiveInteger(input.maximum);
  const increment = parseOptionalPositiveInteger(input.increment);
  const presetTokens = input.presets
    .split(/[\n,]/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const presets = presetTokens.map((value) => parseOptionalPositiveInteger(value));

  if (
    unit === null ||
    minimum === undefined ||
    maximum === undefined ||
    increment === undefined ||
    presets.some((value) => value === undefined || value === null) ||
    presets.length > MAX_QUANTITY_PRESETS ||
    (minimum !== null && maximum !== null && maximum < minimum)
  ) {
    throw new ServiceConfigurationError("INVALID_QUANTITY_CONFIGURATION");
  }

  const numericPresets = presets as number[];
  if (numericPresets.some((preset, index) => index > 0 && preset <= numericPresets[index - 1])) {
    throw new ServiceConfigurationError("INVALID_QUANTITY_CONFIGURATION");
  }

  const hasRules = minimum !== null || maximum !== null || increment !== null || numericPresets.length > 0;
  if (!unit && !hasRules) {
    return null;
  }
  if (!unit) {
    throw new ServiceConfigurationError("INVALID_QUANTITY_CONFIGURATION");
  }

  const configuration: ServiceQuantityConfiguration = {
    increment,
    maximum,
    minimum,
    presets: numericPresets,
    unit,
    version: QUANTITY_CONFIGURATION_VERSION,
  };
  if (!numericPresets.every((preset) => isQuantityAllowed(preset, configuration))) {
    throw new ServiceConfigurationError("INVALID_QUANTITY_CONFIGURATION");
  }
  return configuration;
}

function validateCustomerField(
  input: CustomerFieldConfigurationInput,
): CustomerFieldConfiguration | null {
  const id = input.id.trim();
  const label = normalizeSingleLine(input.label, MAX_CUSTOM_FIELD_LABEL_LENGTH);
  const helpText = normalizeSingleLine(input.helpText, MAX_CUSTOM_FIELD_HELP_LENGTH);
  const type = includesValue(input.type, CUSTOMER_FIELD_TYPES) ? input.type : null;
  const scope = includesValue(input.scope, CUSTOMER_FIELD_SCOPES) ? input.scope : null;
  const options = parseOptions(input.options, MAX_CUSTOM_FIELD_OPTIONS);
  const maxLength = parseOptionalPositiveInteger(input.maxLength, MAX_LONG_TEXT_LENGTH);
  const textType = type === "SHORT_TEXT" || type === "LONG_TEXT";
  const defaultLength = type === "SHORT_TEXT" ? MAX_SHORT_TEXT_LENGTH : MAX_LONG_TEXT_LENGTH;

  if (
    !/^[a-z][a-z0-9-]{2,63}$/u.test(id) ||
    !label ||
    helpText === null ||
    type === null ||
    scope === null ||
    options === null ||
    maxLength === undefined ||
    (type === "SELECTION" && options.length === 0) ||
    (type !== "SELECTION" && options.length > 0) ||
    (!textType && maxLength !== null)
  ) {
    return null;
  }

  return {
    helpText: helpText || null,
    id,
    label,
    maxLength: textType ? (maxLength ?? defaultLength) : null,
    options,
    required: input.required,
    scope,
    type,
  };
}

export function validateSpecificationConfiguration(
  input: SpecificationConfigurationInput,
): ServiceSpecificationConfiguration | null {
  const materials = parseOptions(input.materialOptions);
  const finishing = parseOptions(input.finishingOptions);
  const standardSizes = parseOptions(input.standardSizeOptions);
  const instructions = normalizeSingleLine(input.customInstructions, MAX_SERVICE_INSTRUCTIONS_LENGTH);
  const artworkRequirement = input.artworkRequirement
    ? includesValue(input.artworkRequirement, ARTWORK_REQUIREMENTS)
      ? input.artworkRequirement
      : null
    : null;
  const sizeMode = includesValue(input.sizeMode, SIZE_MODES) ? input.sizeMode : null;
  const fixedUnit = includesValue(input.fixedSizeUnit, DIMENSION_UNITS)
    ? input.fixedSizeUnit
    : null;
  const customUnits = input.customDimensionUnits.filter((unit): unit is DimensionUnit =>
    includesValue(unit, DIMENSION_UNITS),
  );
  const fields = input.customFields.map(validateCustomerField);

  if (
    materials === null ||
    finishing === null ||
    standardSizes === null ||
    instructions === null ||
    (input.artworkRequirement && artworkRequirement === null) ||
    sizeMode === null ||
    customUnits.length !== input.customDimensionUnits.length ||
    new Set(customUnits).size !== customUnits.length ||
    fields.length > MAX_CUSTOM_FIELDS ||
    fields.some((field) => field === null) ||
    (input.materialsRequired && materials.length === 0) ||
    (input.finishingRequired && finishing.length === 0)
  ) {
    throw new ServiceConfigurationError("INVALID_SPECIFICATION_CONFIGURATION");
  }

  const customerFields = fields as CustomerFieldConfiguration[];
  const fieldIds = customerFields.map((field) => field.id);
  const fieldLabels = customerFields.map((field) => field.label.toLocaleLowerCase("en"));
  if (
    new Set(fieldIds).size !== fieldIds.length ||
    new Set(fieldLabels).size !== fieldLabels.length ||
    (!input.variationsEnabled && customerFields.some((field) => field.scope === "VARIATION"))
  ) {
    throw new ServiceConfigurationError("INVALID_SPECIFICATION_CONFIGURATION");
  }

  const needsPresetSizes = sizeMode === "PRESET" || sizeMode === "PRESET_OR_CUSTOM";
  const needsCustomSize = sizeMode === "CUSTOM" || sizeMode === "PRESET_OR_CUSTOM";
  const fixedWidth = sizeMode === "FIXED" ? parseDimension(input.fixedSizeWidth) : null;
  const fixedHeight = sizeMode === "FIXED" ? parseDimension(input.fixedSizeHeight) : null;
  if (
    (needsPresetSizes && standardSizes.length === 0) ||
    (!needsPresetSizes && standardSizes.length > 0) ||
    (needsCustomSize && customUnits.length === 0) ||
    (!needsCustomSize && customUnits.length > 0) ||
    (sizeMode === "FIXED" && (!fixedWidth || !fixedHeight || !fixedUnit)) ||
    (sizeMode !== "FIXED" && Boolean(input.fixedSizeWidth || input.fixedSizeHeight || input.fixedSizeUnit))
  ) {
    throw new ServiceConfigurationError("INVALID_SPECIFICATION_CONFIGURATION");
  }

  const hasConfiguration =
    sizeMode !== "NO_SIZE" ||
    materials.length > 0 ||
    finishing.length > 0 ||
    artworkRequirement !== null ||
    Boolean(instructions) ||
    customerFields.length > 0 ||
    input.variationsEnabled;
  if (!hasConfiguration) {
    return null;
  }

  return {
    artworkRequirement,
    customerFields,
    customInstructions: instructions || null,
    finishing: { options: finishing, required: input.finishingRequired },
    materials: { options: materials, required: input.materialsRequired },
    sizes: {
      customUnits,
      fixed:
        sizeMode === "FIXED" && fixedWidth && fixedHeight && fixedUnit
          ? { height: fixedHeight, unit: fixedUnit, width: fixedWidth }
          : null,
      mode: sizeMode,
      options: standardSizes,
    },
    variations: { enabled: input.variationsEnabled, maxItems: MAX_VARIATIONS },
    version: SPECIFICATION_CONFIGURATION_VERSION,
  };
}

function validateExactCustomerValue(field: CustomerFieldConfiguration, value: string) {
  if (hasUnsafePlainText(value, field.type === "LONG_TEXT")) {
    return false;
  }
  if (!value.trim()) {
    return !field.required;
  }
  if (
    (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT") &&
    value.length > (field.maxLength ?? 0)
  ) {
    return false;
  }
  if (field.type === "NUMBER" && !/^-?(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/u.test(value)) {
    return false;
  }
  if (field.type === "DATE") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) {
      return false;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
      return false;
    }
  }
  if (field.type === "SELECTION" && !field.options.includes(value)) {
    return false;
  }
  return true;
}

export function validateCustomerFieldValues(
  fields: readonly CustomerFieldConfiguration[],
  scope: CustomerFieldScope,
  values: Record<string, string>,
) {
  const scopedFields = fields.filter((field) => field.scope === scope);
  const allowedIds = new Set(scopedFields.map((field) => field.id));
  if (Object.keys(values).some((key) => !allowedIds.has(key))) {
    throw new ServiceConfigurationError("INVALID_CUSTOMER_FIELD_VALUES");
  }
  const result: Record<string, string> = {};
  for (const field of scopedFields) {
    const value = values[field.id] ?? "";
    if (!validateExactCustomerValue(field, value)) {
      throw new ServiceConfigurationError("INVALID_CUSTOMER_FIELD_VALUES");
    }
    if (value !== "") {
      result[field.id] = value;
    }
  }
  return result;
}

export function validateVariationOrder(
  quantity: ServiceQuantityConfiguration | null,
  specification: ServiceSpecificationConfiguration,
  variations: readonly FutureVariationInput[],
): ValidatedVariationOrder {
  if (
    !specification.variations.enabled ||
    variations.length < 1 ||
    variations.length > specification.variations.maxItems
  ) {
    throw new ServiceConfigurationError("INVALID_VARIATIONS");
  }
  const ids = variations.map((variation) => variation.id);
  if (
    ids.some((id) => !/^[A-Za-z0-9_-]{1,64}$/u.test(id)) ||
    new Set(ids).size !== ids.length
  ) {
    throw new ServiceConfigurationError("INVALID_VARIATIONS");
  }

  let totalQuantity = 0;
  const validated = variations.map((variation) => {
    if (!Number.isSafeInteger(variation.quantity) || variation.quantity < 1) {
      throw new ServiceConfigurationError("INVALID_VARIATIONS");
    }
    totalQuantity += variation.quantity;
    if (!Number.isSafeInteger(totalQuantity) || totalQuantity > MAX_SERVICE_QUANTITY) {
      throw new ServiceConfigurationError("INVALID_VARIATIONS");
    }
    return {
      ...variation,
      fieldValues: validateCustomerFieldValues(
        specification.customerFields,
        "VARIATION",
        variation.fieldValues,
      ),
      specificationKey: variation.specificationKey ?? null,
    };
  });
  if (!isQuantityAllowed(totalQuantity, quantity)) {
    throw new ServiceConfigurationError("INVALID_VARIATIONS");
  }
  const keys = new Set(
    validated
      .map((variation) => variation.specificationKey)
      .filter((value): value is string => Boolean(value)),
  );
  return {
    hasMixedSpecifications: keys.size > 1,
    totalQuantity,
    variations: validated,
  };
}

export function formatQuantityRule(configuration: ServiceQuantityConfiguration | null) {
  if (!configuration) {
    return null;
  }
  const unit = configuration.unit;
  if (configuration.minimum !== null && configuration.maximum !== null) {
    return `${configuration.minimum.toLocaleString("en-US")}–${configuration.maximum.toLocaleString("en-US")} ${unit}`;
  }
  if (configuration.minimum !== null) {
    return `Minimum order: ${configuration.minimum.toLocaleString("en-US")} ${unit}`;
  }
  if (configuration.maximum !== null) {
    return `Up to ${configuration.maximum.toLocaleString("en-US")} ${unit}`;
  }
  return `Quantity measured in ${unit}`;
}

export function readQuantityConfiguration(value: unknown): ServiceQuantityConfiguration | null {
  if (!isRecord(value) || value.version !== QUANTITY_CONFIGURATION_VERSION) {
    return null;
  }
  try {
    return validateQuantityConfiguration({
      increment: value.increment === null ? "" : String(value.increment ?? ""),
      maximum: value.maximum === null ? "" : String(value.maximum ?? ""),
      minimum: value.minimum === null ? "" : String(value.minimum ?? ""),
      presets: Array.isArray(value.presets) ? value.presets.map(String).join(",") : "",
      unit: typeof value.unit === "string" ? value.unit : "",
    });
  } catch {
    return null;
  }
}

function readLegacySpecification(value: Record<string, unknown>) {
  const sizes = isRecord(value.sizes) ? value.sizes : {};
  const materials = isRecord(value.materials) ? value.materials : {};
  const finishing = isRecord(value.finishing) ? value.finishing : {};
  const dimensions = isRecord(value.customDimensions) ? value.customDimensions : {};
  const sizeOptions = Array.isArray(sizes.options) ? sizes.options.map(String) : [];
  const units = Array.isArray(dimensions.units) ? dimensions.units.map(String) : [];
  const dimensionsEnabled = dimensions.enabled === true;
  const sizeMode = sizeOptions.length > 0
    ? dimensionsEnabled
      ? "PRESET_OR_CUSTOM"
      : "PRESET"
    : dimensionsEnabled
      ? "CUSTOM"
      : "NO_SIZE";
  return validateSpecificationConfiguration({
    artworkRequirement: typeof value.artworkRequirement === "string" ? value.artworkRequirement : "",
    customDimensionUnits: units,
    customFields: [],
    customInstructions: typeof value.customInstructions === "string" ? value.customInstructions : "",
    finishingOptions: Array.isArray(finishing.options) ? finishing.options.map(String).join("\n") : "",
    finishingRequired: finishing.required === true,
    fixedSizeHeight: "",
    fixedSizeUnit: "",
    fixedSizeWidth: "",
    materialOptions: Array.isArray(materials.options) ? materials.options.map(String).join("\n") : "",
    materialsRequired: materials.required === true,
    sizeMode,
    standardSizeOptions: sizeOptions.join("\n"),
    variationsEnabled: false,
  });
}

export function readSpecificationConfiguration(value: unknown): ServiceSpecificationConfiguration | null {
  if (!isRecord(value)) {
    return null;
  }
  try {
    if (value.version === LEGACY_SPECIFICATION_CONFIGURATION_VERSION) {
      return readLegacySpecification(value);
    }
    if (value.version !== SPECIFICATION_CONFIGURATION_VERSION) {
      return null;
    }
    const sizes = isRecord(value.sizes) ? value.sizes : {};
    const materials = isRecord(value.materials) ? value.materials : {};
    const finishing = isRecord(value.finishing) ? value.finishing : {};
    const variations = isRecord(value.variations) ? value.variations : {};
    const fixed = isRecord(sizes.fixed) ? sizes.fixed : {};
    const rawFields = Array.isArray(value.customerFields) ? value.customerFields : [];
    const customFields = rawFields.map((raw): CustomerFieldConfigurationInput => {
      const field = isRecord(raw) ? raw : {};
      return {
        helpText: typeof field.helpText === "string" ? field.helpText : "",
        id: typeof field.id === "string" ? field.id : "",
        label: typeof field.label === "string" ? field.label : "",
        maxLength: field.maxLength === null ? "" : String(field.maxLength ?? ""),
        options: Array.isArray(field.options) ? field.options.map(String).join("\n") : "",
        required: field.required === true,
        scope: typeof field.scope === "string" ? field.scope : "",
        type: typeof field.type === "string" ? field.type : "",
      };
    });
    return validateSpecificationConfiguration({
      artworkRequirement: typeof value.artworkRequirement === "string" ? value.artworkRequirement : "",
      customDimensionUnits: Array.isArray(sizes.customUnits) ? sizes.customUnits.map(String) : [],
      customFields,
      customInstructions: typeof value.customInstructions === "string" ? value.customInstructions : "",
      finishingOptions: Array.isArray(finishing.options) ? finishing.options.map(String).join("\n") : "",
      finishingRequired: finishing.required === true,
      fixedSizeHeight: typeof fixed.height === "string" ? fixed.height : "",
      fixedSizeUnit: typeof fixed.unit === "string" ? fixed.unit : "",
      fixedSizeWidth: typeof fixed.width === "string" ? fixed.width : "",
      materialOptions: Array.isArray(materials.options) ? materials.options.map(String).join("\n") : "",
      materialsRequired: materials.required === true,
      sizeMode: typeof sizes.mode === "string" ? sizes.mode : "",
      standardSizeOptions: Array.isArray(sizes.options) ? sizes.options.map(String).join("\n") : "",
      variationsEnabled: variations.enabled === true,
    });
  } catch {
    return null;
  }
}
