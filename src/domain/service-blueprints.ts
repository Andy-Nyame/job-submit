import {
  validateQuantityConfiguration,
  validateSpecificationConfiguration,
  type CustomerFieldConfigurationInput,
  type ServiceQuantityConfiguration,
  type ServiceSpecificationConfiguration,
} from "./service-configuration";
import { priceOnRequestConfiguration, type ServicePricingConfiguration } from "./service-pricing";
import type { ApprovedPricingProfile, ServicePricingStrategy } from "./service-pricing-strategies";

export type ServiceConfigurationProfile =
  | "BANNER_PRINTING"
  | "CONTAINER_NUMBER"
  | "FOR_SALE_STICKERS"
  | "LABEL_PRINTING"
  | "ON_REQUEST"
  | "POSTER_PRINTING"
  | "STICKER_PRINTING";

interface ServiceBlueprint {
  example: string;
  label: string;
  pricing: ServicePricingConfiguration;
  quantity: ServiceQuantityConfiguration | null;
  specification: ServiceSpecificationConfiguration | null;
  summary: string;
}

const field = (
  id: string,
  label: string,
  input: Partial<CustomerFieldConfigurationInput> = {},
): CustomerFieldConfigurationInput => ({
  helpText: "",
  id,
  label,
  maxLength: "160",
  options: "",
  required: true,
  scope: "JOB",
  type: "SHORT_TEXT",
  ...input,
});

function strategy(profile: ApprovedPricingProfile, value: ServicePricingStrategy): ServicePricingConfiguration {
  return { fixed: null, mode: "FIXED", profile, strategy: value, version: 2 };
}

function quantity(minimum: string, increment: string, unit: string) {
  return validateQuantityConfiguration({ increment, maximum: "", minimum, presets: "", unit });
}

function specification(input: {
  artworkRequirement?: string;
  customDimensionUnits?: string[];
  customFields?: CustomerFieldConfigurationInput[];
  customInstructions?: string;
  fixedSizeHeight?: string;
  fixedSizeUnit?: string;
  fixedSizeWidth?: string;
  sizeMode?: string;
  standardSizeOptions?: string;
}) {
  return validateSpecificationConfiguration({
    artworkRequirement: input.artworkRequirement ?? "",
    customDimensionUnits: input.customDimensionUnits ?? [],
    customFields: input.customFields ?? [],
    customInstructions: input.customInstructions ?? "",
    finishingOptions: "",
    finishingRequired: false,
    fixedSizeHeight: input.fixedSizeHeight ?? "",
    fixedSizeUnit: input.fixedSizeUnit ?? "",
    fixedSizeWidth: input.fixedSizeWidth ?? "",
    materialOptions: "",
    materialsRequired: false,
    sizeMode: input.sizeMode ?? "NO_SIZE",
    standardSizeOptions: input.standardSizeOptions ?? "",
    variationsEnabled: false,
  });
}

export const SERVICE_BLUEPRINTS: Record<ServiceConfigurationProfile, ServiceBlueprint> = {
  BANNER_PRINTING: {
    example: "Example: one 2 × 3 foot banner is GH₵25 after the approved selling-price rounding.",
    label: "Banner printing — GH₵4 per square foot",
    pricing: strategy("BANNER_PRINTING", "AREA_BASED"),
    quantity: quantity("1", "1", "banner"),
    specification: specification({
      artworkRequirement: "CUSTOMER_PROVIDED",
      customDimensionUnits: ["FEET", "INCHES", "CM", "MM", "METERS"],
      customInstructions: "Enter the finished banner size. Printing-only requests need finished artwork.",
      sizeMode: "CUSTOM",
    }),
    summary: "Width × height × quantity at GH₵4 per square foot, rounded up to the next GH₵5.",
  },
  CONTAINER_NUMBER: {
    example: "Example: one A3 sticker marked C001 is GH₵30.",
    label: "Container / batch number sticker — A3 GH₵30",
    pricing: strategy("CONTAINER_NUMBER", "FIXED_VARIANT"),
    quantity: quantity("1", "1", "sticker"),
    specification: specification({
      artworkRequirement: "NOT_REQUIRED",
      customFields: [field("container-number", "What number should we print?", { helpText: "Use one letter followed by three digits, for example C001." })],
      fixedSizeHeight: "16",
      fixedSizeUnit: "INCHES",
      fixedSizeWidth: "11",
      sizeMode: "FIXED",
    }),
    summary: "One A3 sticker for GH₵30. The number must be one letter followed by three digits.",
  },
  FOR_SALE_STICKERS: {
    example: "Example: four A4 stickers are GH₵40; four A3 stickers are GH₵80.",
    label: "For Sale stickers — A4 or A3 in pairs",
    pricing: strategy("FOR_SALE_STICKERS", "SIZE_VARIANT_QUANTITY_GROUP"),
    quantity: quantity("2", "2", "stickers"),
    specification: specification({
      artworkRequirement: "NOT_REQUIRED",
      customFields: [
        field("printed-contact-count", "How many contact numbers should appear?", { maxLength: "", options: "1\n2", type: "SELECTION" }),
        field("printed-contact-1", "First number to print", { helpText: "Enter it exactly as it should appear, including any leading zero." }),
        field("printed-contact-2", "Second number to print", { helpText: "Required only when you choose two contact numbers.", required: false }),
      ],
      sizeMode: "PRESET",
      standardSizeOptions: "A4\nA3",
    }),
    summary: "A4 is GH₵20 per pair; A3 is GH₵40 per pair.",
  },
  LABEL_PRINTING: {
    example: "Example: sixty 2 × 2 inch square labels are GH₵25.",
    label: "Label printing — material and cutting price",
    pricing: strategy("LABEL_PRINTING", "MATERIAL_LAYOUT_PLUS_CUTTING"),
    quantity: quantity("60", "1", "labels"),
    specification: specification({
      artworkRequirement: "CUSTOMER_PROVIDED",
      customDimensionUnits: ["INCHES"],
      customFields: [
        field("label-shape", "What shape are the labels?", {
          maxLength: "",
          options: "Square\nRectangle\nRounded corners\nCustom / irregular",
          type: "SELECTION",
        }),
      ],
      customInstructions: "Enter the finished size of one label in inches. Printing-only requests need finished artwork.",
      sizeMode: "CUSTOM",
    }),
    summary: "Uses the approved 45-inch material layout, printing charge, and cutting charge.",
  },
  ON_REQUEST: {
    example: "Example: the customer submits the details and sees that management will send the price after review.",
    label: "Price after review",
    pricing: priceOnRequestConfiguration(),
    quantity: null,
    specification: null,
    summary: "The customer sends the details and management confirms the price after review.",
  },
  POSTER_PRINTING: {
    example: "Examples: four A4 posters are GH₵15; two A1 posters are GH₵40.",
    label: "Poster printing — approved A-series prices",
    pricing: strategy("POSTER_PRINTING", "SIZE_VARIANT_QUANTITY_GROUP"),
    quantity: quantity("2", "2", "posters"),
    specification: specification({
      artworkRequirement: "CUSTOMER_PROVIDED",
      customInstructions: "Choose an A-series size. Printing-only requests need finished artwork.",
      sizeMode: "PRESET",
      standardSizeOptions: "A4\nA3\nA2\nA1",
    }),
    summary: "Approved A4, A3, A2, and A1 complete-row prices, rounded up to the next GH₵5.",
  },
  STICKER_PRINTING: {
    example: "Example: one 2 × 2 foot sticker is GH₵15 after the approved selling-price rounding.",
    label: "Sticker printing — GH₵3 per square foot",
    pricing: strategy("STICKER_PRINTING", "AREA_BASED"),
    quantity: quantity("1", "1", "pieces"),
    specification: specification({
      artworkRequirement: "CUSTOMER_PROVIDED",
      customDimensionUnits: ["FEET", "INCHES", "CM", "MM", "METERS"],
      customInstructions: "Enter the finished sticker size. Printing-only requests need finished artwork.",
      sizeMode: "CUSTOM",
    }),
    summary: "Width × height × quantity at GH₵3 per square foot, rounded up to the next GH₵5.",
  },
};

export function profilesForService(slug: string): ServiceConfigurationProfile[] {
  if (slug === "sav-sticker-printing") return ["STICKER_PRINTING", "ON_REQUEST"];
  if (slug === "flexi-banner-printing") return ["BANNER_PRINTING", "ON_REQUEST"];
  if (slug === "for-sale-sticker-printing") return ["FOR_SALE_STICKERS", "ON_REQUEST"];
  if (slug === "container-head-sticker-batch-numbers-printing") return ["CONTAINER_NUMBER", "ON_REQUEST"];
  if (slug === "poster-printing") return ["POSTER_PRINTING", "ON_REQUEST"];
  if (slug === "label-printing") return ["LABEL_PRINTING", "ON_REQUEST"];
  return ["ON_REQUEST"];
}

export function profileForPricing(value: unknown): ServiceConfigurationProfile {
  if (typeof value === "object" && value !== null && "profile" in value) {
    const profile = (value as { profile?: unknown }).profile;
    if (typeof profile === "string" && Object.hasOwn(SERVICE_BLUEPRINTS, profile)) return profile as ServiceConfigurationProfile;
  }
  return "ON_REQUEST";
}
