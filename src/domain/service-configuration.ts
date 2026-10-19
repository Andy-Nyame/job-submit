export const SERVICE_CONFIGURATION_VERSION = 1 as const;
export const MAX_SERVICE_QUANTITY = 1_000_000;
export const MAX_QUANTITY_PRESETS = 20;
export const MAX_QUANTITY_UNIT_LENGTH = 32;
export const MAX_SPECIFICATION_OPTIONS = 20;
export const MAX_SPECIFICATION_OPTION_LENGTH = 80;
export const MAX_SERVICE_INSTRUCTIONS_LENGTH = 500;
export const MAX_PRICE_GUIDANCE_MINOR = 100_000_000n;

export const ARTWORK_REQUIREMENTS = [
  "CUSTOMER_PROVIDED",
  "BUSINESS_DESIGN",
  "EITHER",
  "NOT_REQUIRED",
] as const;

export const DIMENSION_UNITS = ["MM", "CM", "INCHES", "FEET"] as const;

export const INDICATIVE_PRICE_DISCLAIMER =
  "Estimated price range only. Final pricing is confirmed privately after job review.";

export type ArtworkRequirement = (typeof ARTWORK_REQUIREMENTS)[number];
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

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
  version: typeof SERVICE_CONFIGURATION_VERSION;
}

export interface SpecificationConfigurationInput {
  artworkRequirement: string;
  customDimensionsEnabled: boolean;
  customDimensionsRequired: boolean;
  customInstructions: string;
  dimensionUnits: string[];
  finishingOptions: string;
  finishingRequired: boolean;
  materialOptions: string;
  materialsRequired: boolean;
  sizeOptions: string;
  sizesRequired: boolean;
}

export interface ServiceSpecificationConfiguration {
  artworkRequirement: ArtworkRequirement | null;
  customDimensions: {
    enabled: boolean;
    required: boolean;
    units: DimensionUnit[];
  };
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
    options: string[];
    required: boolean;
  };
  version: typeof SERVICE_CONFIGURATION_VERSION;
}

export interface IndicativePriceInput {
  description: string;
  maximum: string;
  minimum: string;
}

export interface ValidatedIndicativePrice {
  description: string | null;
  maximumMinor: bigint | null;
  minimumMinor: bigint | null;
}

export type ServiceConfigurationErrorCode =
  | "INVALID_PRICE_GUIDANCE"
  | "INVALID_QUANTITY_CONFIGURATION"
  | "INVALID_SPECIFICATION_CONFIGURATION";

export class ServiceConfigurationError extends Error {
  constructor(public readonly code: ServiceConfigurationErrorCode) {
    super(code);
    this.name = "ServiceConfigurationError";
  }
}

function normalizeSingleLine(value: string, maximumLength: number) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  const hasUnsafeCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === "<" || character === ">" || codePoint < 32 || codePoint === 127;
  });
  if (
    normalized.length > maximumLength ||
    hasUnsafeCharacter
  ) {
    return null;
  }
  return normalized;
}

function parseOptionalPositiveInteger(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (!/^\d+$/u.test(normalized)) {
    return undefined;
  }
  const number = Number(normalized);
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > MAX_SERVICE_QUANTITY
  ) {
    return undefined;
  }
  return number;
}

export function isQuantityAllowed(
  quantity: number,
  configuration: ServiceQuantityConfiguration | null,
) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_SERVICE_QUANTITY
  ) {
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
  const presets = presetTokens.map(parseOptionalPositiveInteger);

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
  if (
    numericPresets.some(
      (preset, index) =>
        index > 0 && preset <= numericPresets[index - 1],
    )
  ) {
    throw new ServiceConfigurationError("INVALID_QUANTITY_CONFIGURATION");
  }

  const hasRules =
    minimum !== null ||
    maximum !== null ||
    increment !== null ||
    numericPresets.length > 0;
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
    version: SERVICE_CONFIGURATION_VERSION,
  };
  if (!numericPresets.every((preset) => isQuantityAllowed(preset, configuration))) {
    throw new ServiceConfigurationError("INVALID_QUANTITY_CONFIGURATION");
  }
  return configuration;
}

function parseOptions(value: string) {
  const rawOptions = value
    .split(/\r?\n/u)
    .map((option) => normalizeSingleLine(option, MAX_SPECIFICATION_OPTION_LENGTH))
    .filter((option) => option !== "");
  if (
    rawOptions.length > MAX_SPECIFICATION_OPTIONS ||
    rawOptions.some((option) => option === null)
  ) {
    return null;
  }
  const options = rawOptions as string[];
  const normalizedKeys = options.map((option) => option.toLocaleLowerCase("en"));
  if (new Set(normalizedKeys).size !== normalizedKeys.length) {
    return null;
  }
  return options;
}

function includesValue<T extends string>(value: string, values: readonly T[]): value is T {
  return values.some((candidate) => candidate === value);
}

export function validateSpecificationConfiguration(
  input: SpecificationConfigurationInput,
): ServiceSpecificationConfiguration | null {
  const sizes = parseOptions(input.sizeOptions);
  const materials = parseOptions(input.materialOptions);
  const finishing = parseOptions(input.finishingOptions);
  const instructions = normalizeSingleLine(
    input.customInstructions,
    MAX_SERVICE_INSTRUCTIONS_LENGTH,
  );
  const artworkRequirement = input.artworkRequirement
    ? includesValue(input.artworkRequirement, ARTWORK_REQUIREMENTS)
      ? input.artworkRequirement
      : undefined
    : null;
  const dimensionUnits = input.dimensionUnits.filter((unit): unit is DimensionUnit =>
    includesValue(unit, DIMENSION_UNITS),
  );

  if (
    sizes === null ||
    materials === null ||
    finishing === null ||
    instructions === null ||
    artworkRequirement === undefined ||
    dimensionUnits.length !== input.dimensionUnits.length ||
    new Set(dimensionUnits).size !== dimensionUnits.length ||
    (input.sizesRequired && sizes.length === 0) ||
    (input.materialsRequired && materials.length === 0) ||
    (input.finishingRequired && finishing.length === 0) ||
    (!input.customDimensionsEnabled &&
      (input.customDimensionsRequired || dimensionUnits.length > 0)) ||
    (input.customDimensionsEnabled && dimensionUnits.length === 0)
  ) {
    throw new ServiceConfigurationError("INVALID_SPECIFICATION_CONFIGURATION");
  }

  const hasConfiguration =
    sizes.length > 0 ||
    materials.length > 0 ||
    finishing.length > 0 ||
    artworkRequirement !== null ||
    input.customDimensionsEnabled ||
    Boolean(instructions);
  if (!hasConfiguration) {
    return null;
  }

  return {
    artworkRequirement,
    customDimensions: {
      enabled: input.customDimensionsEnabled,
      required: input.customDimensionsRequired,
      units: dimensionUnits,
    },
    customInstructions: instructions || null,
    finishing: { options: finishing, required: input.finishingRequired },
    materials: { options: materials, required: input.materialsRequired },
    sizes: { options: sizes, required: input.sizesRequired },
    version: SERVICE_CONFIGURATION_VERSION,
  };
}

function parseMoneyToMinor(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const match = /^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/u.exec(normalized);
  if (!match) {
    return undefined;
  }
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return minor <= MAX_PRICE_GUIDANCE_MINOR ? minor : undefined;
}

export function validateIndicativePrice(
  input: IndicativePriceInput,
): ValidatedIndicativePrice {
  const minimumMinor = parseMoneyToMinor(input.minimum);
  const maximumMinor = parseMoneyToMinor(input.maximum);
  const description = normalizeSingleLine(
    input.description,
    MAX_SERVICE_INSTRUCTIONS_LENGTH,
  );

  if (
    minimumMinor === undefined ||
    maximumMinor === undefined ||
    description === null ||
    (minimumMinor === null) !== (maximumMinor === null) ||
    (minimumMinor !== null && maximumMinor !== null && minimumMinor > maximumMinor) ||
    (minimumMinor === null && Boolean(description))
  ) {
    throw new ServiceConfigurationError("INVALID_PRICE_GUIDANCE");
  }

  return {
    description: description || null,
    maximumMinor,
    minimumMinor,
  };
}

export function formatGhanaCediMinor(value: bigint) {
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, "0");
  return `GH₵${whole.toLocaleString("en-US")}.${fraction}`;
}

export function formatIndicativePriceRange(minimum: bigint, maximum: bigint) {
  return `${formatGhanaCediMinor(minimum)} – ${formatGhanaCediMinor(maximum)}`;
}

export function formatMoneyInput(value: bigint | null) {
  if (value === null) {
    return "";
  }
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readQuantityConfiguration(
  value: unknown,
): ServiceQuantityConfiguration | null {
  if (!isRecord(value) || value.version !== SERVICE_CONFIGURATION_VERSION) {
    return null;
  }
  try {
    const presets = Array.isArray(value.presets)
      ? value.presets.map(String).join(",")
      : "";
    return validateQuantityConfiguration({
      increment: value.increment === null ? "" : String(value.increment ?? ""),
      maximum: value.maximum === null ? "" : String(value.maximum ?? ""),
      minimum: value.minimum === null ? "" : String(value.minimum ?? ""),
      presets,
      unit: typeof value.unit === "string" ? value.unit : "",
    });
  } catch {
    return null;
  }
}

export function readSpecificationConfiguration(
  value: unknown,
): ServiceSpecificationConfiguration | null {
  if (!isRecord(value) || value.version !== SERVICE_CONFIGURATION_VERSION) {
    return null;
  }
  const sizes = isRecord(value.sizes) ? value.sizes : {};
  const materials = isRecord(value.materials) ? value.materials : {};
  const finishing = isRecord(value.finishing) ? value.finishing : {};
  const dimensions = isRecord(value.customDimensions)
    ? value.customDimensions
    : {};
  try {
    return validateSpecificationConfiguration({
      artworkRequirement:
        typeof value.artworkRequirement === "string"
          ? value.artworkRequirement
          : "",
      customDimensionsEnabled: dimensions.enabled === true,
      customDimensionsRequired: dimensions.required === true,
      customInstructions:
        typeof value.customInstructions === "string"
          ? value.customInstructions
          : "",
      dimensionUnits: Array.isArray(dimensions.units)
        ? dimensions.units.map(String)
        : [],
      finishingOptions: Array.isArray(finishing.options)
        ? finishing.options.map(String).join("\n")
        : "",
      finishingRequired: finishing.required === true,
      materialOptions: Array.isArray(materials.options)
        ? materials.options.map(String).join("\n")
        : "",
      materialsRequired: materials.required === true,
      sizeOptions: Array.isArray(sizes.options)
        ? sizes.options.map(String).join("\n")
        : "",
      sizesRequired: sizes.required === true,
    });
  } catch {
    return null;
  }
}
