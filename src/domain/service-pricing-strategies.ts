import type { DimensionUnit } from "./service-configuration";

export const STRATEGY_CONFIGURATION_VERSION = 2 as const;
export const SERVICE_PRICING_STRATEGIES = [
  "AREA_BASED",
  "FIXED_VARIANT",
  "MATERIAL_LAYOUT_PLUS_CUTTING",
  "SIZE_VARIANT_QUANTITY_GROUP",
  "STICKER_PRODUCT_MENU",
] as const;

export type ServicePricingStrategy = (typeof SERVICE_PRICING_STRATEGIES)[number];

export const APPROVED_PRICING_PROFILES = [
  "BANNER_PRINTING",
  "CONTAINER_NUMBER",
  "FOR_SALE_STICKERS",
  "LABEL_PRINTING",
  "POSTER_PRINTING",
  "STICKER_PRINTING",
] as const;
export type ApprovedPricingProfile = (typeof APPROVED_PRICING_PROFILES)[number];

export interface StrategyPricingConfiguration {
  fixed: null;
  mode: "FIXED";
  profile: ApprovedPricingProfile;
  strategy: ServicePricingStrategy;
  version: typeof STRATEGY_CONFIGURATION_VERSION;
}

export interface StrategyPriceInput {
  jobFields: Record<string, string>;
  quantity: number;
  size:
    | { kind: "NONE" }
    | { height: string; kind: "FIXED"; unit: DimensionUnit; width: string }
    | { kind: "PRESET"; option: string }
    | { height: string; kind: "CUSTOM"; unit: DimensionUnit; width: string };
}

export interface StrategyPriceResult {
  basePriceMinor: bigint;
  coverage: string;
  internalCalculation: Record<string, string | number>;
}

const FIVE_CEDIS_MINOR = 500n;
const DECIMAL_SCALE = 1_000n;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readStrategyPricingConfiguration(
  value: unknown,
): StrategyPricingConfiguration | null {
  if (
    !isRecord(value) ||
    value.version !== STRATEGY_CONFIGURATION_VERSION ||
    value.mode !== "FIXED" ||
    value.fixed !== null ||
    typeof value.strategy !== "string" ||
    !SERVICE_PRICING_STRATEGIES.includes(value.strategy as ServicePricingStrategy) ||
    typeof value.profile !== "string" ||
    !APPROVED_PRICING_PROFILES.includes(value.profile as ApprovedPricingProfile)
  ) {
    return null;
  }
  const expectedStrategies: Record<ApprovedPricingProfile, readonly ServicePricingStrategy[]> = {
    BANNER_PRINTING: ["AREA_BASED"],
    CONTAINER_NUMBER: ["FIXED_VARIANT"],
    FOR_SALE_STICKERS: ["SIZE_VARIANT_QUANTITY_GROUP"],
    LABEL_PRINTING: ["MATERIAL_LAYOUT_PLUS_CUTTING"],
    POSTER_PRINTING: ["SIZE_VARIANT_QUANTITY_GROUP"],
    // STICKER_PRODUCT_MENU remains readable for immutable historical snapshots.
    STICKER_PRINTING: ["AREA_BASED", "STICKER_PRODUCT_MENU"],
  };
  if (!expectedStrategies[value.profile as ApprovedPricingProfile].includes(value.strategy as ServicePricingStrategy)) return null;
  return value as unknown as StrategyPricingConfiguration;
}

export function roundUpToFiveCedisMinor(
  numeratorMinor: bigint,
  denominator = 1n,
) {
  if (numeratorMinor < 0n || denominator <= 0n) return null;
  const step = FIVE_CEDIS_MINOR * denominator;
  return ((numeratorMinor + step - 1n) / step) * FIVE_CEDIS_MINOR;
}

function parsePositiveDecimal(value: string) {
  const match = /^(?:0|[1-9]\d{0,5})(?:\.(\d{1,3}))?$/u.exec(value.trim());
  if (!match) return null;
  const [whole = "0"] = value.trim().split(".");
  const scaled = BigInt(whole) * DECIMAL_SCALE + BigInt((match[1] ?? "").padEnd(3, "0"));
  return scaled > 0n ? scaled : null;
}

function unitRatio(unit: DimensionUnit) {
  const ratios: Record<DimensionUnit, readonly [bigint, bigint]> = {
    CM: [25n, 762n],
    FEET: [1n, 1n],
    INCHES: [1n, 12n],
    METERS: [1_250n, 381n],
    MM: [5n, 1_524n],
  };
  return ratios[unit];
}

function areaPrice(
  input: StrategyPriceInput,
  rateMinorPerSquareFoot: bigint,
  coverage: string,
) {
  if (input.size.kind !== "CUSTOM") return null;
  const width = parsePositiveDecimal(input.size.width);
  const height = parsePositiveDecimal(input.size.height);
  if (!width || !height || input.quantity < 1) return null;
  const [unitNumerator, unitDenominator] = unitRatio(input.size.unit);
  const numerator =
    width * height * unitNumerator * unitNumerator * rateMinorPerSquareFoot * BigInt(input.quantity);
  const denominator = DECIMAL_SCALE * DECIMAL_SCALE * unitDenominator * unitDenominator;
  const price = roundUpToFiveCedisMinor(numerator, denominator);
  if (price === null) return null;
  return {
    basePriceMinor: price,
    coverage,
    internalCalculation: {
      height: input.size.height,
      quantity: input.quantity,
      rateMinorPerSquareFoot: rateMinorPerSquareFoot.toString(),
      unit: input.size.unit,
      width: input.size.width,
    },
  } satisfies StrategyPriceResult;
}

function priceForSale(input: StrategyPriceInput) {
  if (input.size.kind !== "PRESET" || input.quantity < 2 || input.quantity % 2 !== 0) return null;
  const groupPrice = input.size.option === "A4" ? 2_000n : input.size.option === "A3" ? 4_000n : null;
  if (groupPrice === null) return null;
  const count = input.jobFields["printed-contact-count"];
  const first = input.jobFields["printed-contact-1"]?.trim();
  const second = input.jobFields["printed-contact-2"]?.trim();
  if ((count !== "1" && count !== "2") || !first || (count === "2" && !second) || (count === "1" && second)) return null;
  return {
    basePriceMinor: (BigInt(input.quantity) / 2n) * groupPrice,
    coverage: `${input.size.option} For Sale stickers`,
    internalCalculation: { groupPriceMinor: groupPrice.toString(), groupSize: 2, quantity: input.quantity, variant: input.size.option },
  } satisfies StrategyPriceResult;
}

function pricePoster(input: StrategyPriceInput) {
  if (input.size.kind !== "PRESET") return null;
  const variants = {
    A1: { heightInches: 33, increment: 2, marginInches: "0.75", minimum: 2, occupiedWidthInches: "46.5", piecesPerRow: 2, priceMinor: 2_000n, sideAcrossInches: 23, widthInches: 23 },
    A2: { heightInches: 23, increment: 2, marginInches: "0.75", minimum: 2, occupiedWidthInches: "46.5", piecesPerRow: 2, priceMinor: 1_000n, sideAcrossInches: 23, widthInches: 16 },
    A3: { heightInches: 16, increment: 4, marginInches: "1.25", minimum: 4, occupiedWidthInches: "45.5", piecesPerRow: 4, priceMinor: 500n, sideAcrossInches: 11, widthInches: 11 },
    A4: { heightInches: 11, increment: 4, marginInches: "1.25", minimum: 4, occupiedWidthInches: "45.5", piecesPerRow: 4, priceMinor: 300n, sideAcrossInches: 11, widthInches: 8 },
  } as const;
  const variant = variants[input.size.option as keyof typeof variants];
  if (!variant || input.quantity < variant.minimum || input.quantity % variant.increment !== 0) return null;
  const total = roundUpToFiveCedisMinor(BigInt(input.quantity) * variant.priceMinor);
  if (total === null) return null;
  return {
    basePriceMinor: total,
    coverage: `${input.size.option} poster printing on sticker material`,
    internalCalculation: {
      approvedHeightInches: variant.heightInches,
      approvedWidthInches: variant.widthInches,
      marginEachSideInches: variant.marginInches,
      materialWidthInches: 48,
      occupiedWidthInches: variant.occupiedWidthInches,
      piecesPerRow: variant.piecesPerRow,
      pricePerPieceMinor: variant.priceMinor.toString(),
      quantity: input.quantity,
      rowGapInches: "0.5",
      sideAcrossInches: variant.sideAcrossInches,
      variant: input.size.option,
    },
  } satisfies StrategyPriceResult;
}

function priceLabels(input: StrategyPriceInput) {
  if (input.size.kind !== "CUSTOM" || input.size.unit !== "INCHES" || input.quantity < 60) return null;
  const shape = input.jobFields["label-shape"];
  if (!["Square", "Rectangle", "Rounded corners", "Custom / irregular"].includes(shape)) return null;
  if (shape === "Custom / irregular") return null;
  const width = parsePositiveDecimal(input.size.width);
  const height = parsePositiveDecimal(input.size.height);
  if (!width || !height) return null;
  const halfInch = 500n;
  const usableWidth = 45_000n;
  const across = Number((usableWidth + halfInch) / (width + halfInch));
  if (across < 1) return null;
  const rows = Math.ceil(input.quantity / across);
  const heightUsed = BigInt(rows) * height + BigInt(rows - 1) * halfInch;
  const chargedFeet = Number((heightUsed + 12_000n - 1n) / 12_000n);
  const printing = roundUpToFiveCedisMinor(BigInt(chargedFeet) * 375n * 300n, 100n);
  if (printing === null) return null;
  const cutting = roundUpToFiveCedisMinor(printing, 2n);
  if (cutting === null) return null;
  return {
    basePriceMinor: printing + cutting,
    coverage: `${input.size.width} × ${input.size.height} inch labels`,
    internalCalculation: {
      chargedHeightFeet: chargedFeet,
      cuttingPriceMinor: cutting.toString(),
      heightUsedInches: `${heightUsed / DECIMAL_SCALE}.${String(heightUsed % DECIMAL_SCALE).padStart(3, "0")}`,
      labelsPerRow: across,
      printingPriceMinor: printing.toString(),
      rows,
    },
  } satisfies StrategyPriceResult;
}

function priceContainer(input: StrategyPriceInput) {
  const number = input.jobFields["container-number"]?.trim().toUpperCase();
  if (input.quantity !== 1 || !/^[A-Z]\d{3}$/u.test(number ?? "")) return null;
  return {
    basePriceMinor: 3_000n,
    coverage: "One A3 container head / batch number sticker",
    internalCalculation: { identificationNumber: number ?? "", quantity: 1, variant: "A3" },
  } satisfies StrategyPriceResult;
}

export function calculateStrategyPrice(
  configuration: StrategyPricingConfiguration,
  input: StrategyPriceInput,
): StrategyPriceResult | null {
  switch (configuration.strategy) {
    case "AREA_BASED":
      return areaPrice(
        input,
        configuration.profile === "BANNER_PRINTING" ? 400n : 300n,
        configuration.profile === "BANNER_PRINTING" ? "Banner printing" : "Custom-size printing",
      );
    case "FIXED_VARIANT":
      return priceContainer(input);
    case "MATERIAL_LAYOUT_PLUS_CUTTING":
      return priceLabels(input);
    case "SIZE_VARIANT_QUANTITY_GROUP":
      return configuration.profile === "POSTER_PRINTING"
        ? pricePoster(input)
        : priceForSale(input);
    case "STICKER_PRODUCT_MENU": {
      const product = input.jobFields["sticker-product"];
      if (product === "Poster printing") return pricePoster(input);
      if (product === "Labels") return priceLabels(input);
      if (product === "Custom-size sticker") return areaPrice(input, 300n, "Custom-size sticker printing");
      return null;
    }
  }
}
