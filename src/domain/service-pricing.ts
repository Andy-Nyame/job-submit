import {
  isQuantityAllowed,
  type ServiceQuantityConfiguration,
} from "./service-configuration";

export const PRICING_CONFIGURATION_VERSION = 1 as const;
export const PRICING_MODES = ["FIXED", "ON_REQUEST"] as const;
export const MAX_FIXED_PRICE_MINOR = 100_000_000n;
export const MAX_PRICE_COVERAGE_LENGTH = 500;

export type PricingMode = (typeof PRICING_MODES)[number];

export interface PricingConfigurationInput {
  additionalStepPrice: string;
  coverage: string;
  mode: string;
  startingPrice: string;
  startingQuantity: string;
}

export interface ServicePricingConfiguration {
  fixed: {
    additionalStepPriceMinor: string;
    coverage: string;
    mixedSpecificationsEligible: false;
    quantityStep: number;
    startingPriceMinor: string;
    startingQuantity: number;
  } | null;
  mode: PricingMode;
  version: typeof PRICING_CONFIGURATION_VERSION;
}

export class ServicePricingError extends Error {
  constructor(
    public readonly code:
      | "INVALID_FIXED_PRICE"
      | "INVALID_PRICING_CONFIGURATION",
  ) {
    super(code);
    this.name = "ServicePricingError";
  }
}

function normalizeCoverage(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  const unsafe = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === "<" || character === ">" || codePoint < 32 || codePoint === 127;
  });
  return normalized.length <= MAX_PRICE_COVERAGE_LENGTH && !unsafe
    ? normalized
    : null;
}

export function parseGhanaCediToMinor(value: string) {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/u.exec(normalized);
  if (!match) {
    return null;
  }
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return minor <= MAX_FIXED_PRICE_MINOR ? minor : null;
}

function parseStartingQuantity(value: string) {
  if (!/^\d+$/u.test(value.trim())) {
    return null;
  }
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

export function priceOnRequestConfiguration(): ServicePricingConfiguration {
  return {
    fixed: null,
    mode: "ON_REQUEST",
    version: PRICING_CONFIGURATION_VERSION,
  };
}

export function validatePricingConfiguration(
  input: PricingConfigurationInput,
  quantity: ServiceQuantityConfiguration | null,
): ServicePricingConfiguration {
  if (input.mode === "ON_REQUEST") {
    if (
      input.startingQuantity.trim() ||
      input.startingPrice.trim() ||
      input.additionalStepPrice.trim() ||
      input.coverage.trim()
    ) {
      throw new ServicePricingError("INVALID_PRICING_CONFIGURATION");
    }
    return priceOnRequestConfiguration();
  }
  if (input.mode !== "FIXED") {
    throw new ServicePricingError("INVALID_PRICING_CONFIGURATION");
  }

  const startingQuantity = parseStartingQuantity(input.startingQuantity);
  const startingPriceMinor = parseGhanaCediToMinor(input.startingPrice);
  const additionalStepPriceMinor = parseGhanaCediToMinor(input.additionalStepPrice);
  const coverage = normalizeCoverage(input.coverage);
  if (
    startingQuantity === null ||
    startingPriceMinor === null ||
    additionalStepPriceMinor === null ||
    !coverage ||
    quantity?.increment === null ||
    !quantity ||
    !isQuantityAllowed(startingQuantity, quantity)
  ) {
    throw new ServicePricingError("INVALID_FIXED_PRICE");
  }

  return {
    fixed: {
      additionalStepPriceMinor: additionalStepPriceMinor.toString(),
      coverage,
      mixedSpecificationsEligible: false,
      quantityStep: quantity.increment,
      startingPriceMinor: startingPriceMinor.toString(),
      startingQuantity,
    },
    mode: "FIXED",
    version: PRICING_CONFIGURATION_VERSION,
  };
}

export function calculateFixedPrice(
  configuration: ServicePricingConfiguration,
  quantityConfiguration: ServiceQuantityConfiguration | null,
  input: { hasMixedSpecifications: boolean; totalQuantity: number },
) {
  const fixed = configuration.fixed;
  if (
    configuration.mode !== "FIXED" ||
    !fixed ||
    input.hasMixedSpecifications ||
    !isQuantityAllowed(input.totalQuantity, quantityConfiguration) ||
    input.totalQuantity < fixed.startingQuantity ||
    (input.totalQuantity - fixed.startingQuantity) % fixed.quantityStep !== 0
  ) {
    return null;
  }
  const additionalSteps = BigInt(
    (input.totalQuantity - fixed.startingQuantity) / fixed.quantityStep,
  );
  const total =
    BigInt(fixed.startingPriceMinor) +
    additionalSteps * BigInt(fixed.additionalStepPriceMinor);
  return total <= MAX_FIXED_PRICE_MINOR ? total : null;
}

export function formatGhanaCediMinor(value: bigint) {
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, "0");
  return `GH₵${whole.toLocaleString("en-US")}.${fraction}`;
}

export function formatMoneyInput(value: bigint | string | null) {
  if (value === null) {
    return "";
  }
  const minor = typeof value === "string" ? BigInt(value) : value;
  return `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readPricingConfiguration(value: unknown): ServicePricingConfiguration {
  if (!isRecord(value) || value.version !== PRICING_CONFIGURATION_VERSION) {
    return priceOnRequestConfiguration();
  }
  if (value.mode === "ON_REQUEST" && value.fixed === null) {
    return priceOnRequestConfiguration();
  }
  if (value.mode !== "FIXED" || !isRecord(value.fixed)) {
    return priceOnRequestConfiguration();
  }
  const fixed = value.fixed;
  const startingQuantity = Number(fixed.startingQuantity);
  const quantityStep = Number(fixed.quantityStep);
  const coverage = typeof fixed.coverage === "string" ? normalizeCoverage(fixed.coverage) : null;
  const startingPrice = typeof fixed.startingPriceMinor === "string"
    ? fixed.startingPriceMinor
    : "";
  const additionalPrice = typeof fixed.additionalStepPriceMinor === "string"
    ? fixed.additionalStepPriceMinor
    : "";
  if (
    !Number.isSafeInteger(startingQuantity) ||
    startingQuantity < 1 ||
    !Number.isSafeInteger(quantityStep) ||
    quantityStep < 1 ||
    !coverage ||
    !/^\d+$/u.test(startingPrice) ||
    !/^\d+$/u.test(additionalPrice) ||
    BigInt(startingPrice) > MAX_FIXED_PRICE_MINOR ||
    BigInt(additionalPrice) > MAX_FIXED_PRICE_MINOR ||
    fixed.mixedSpecificationsEligible !== false
  ) {
    return priceOnRequestConfiguration();
  }
  return {
    fixed: {
      additionalStepPriceMinor: additionalPrice,
      coverage,
      mixedSpecificationsEligible: false,
      quantityStep,
      startingPriceMinor: startingPrice,
      startingQuantity,
    },
    mode: "FIXED",
    version: PRICING_CONFIGURATION_VERSION,
  };
}
