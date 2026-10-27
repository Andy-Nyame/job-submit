import { readQuantityConfiguration } from "./service-configuration";
import {
  formatGhanaCediMinor,
  readPricingConfiguration,
} from "./service-pricing";
import { readStrategyPricingConfiguration } from "./service-pricing-strategies";

export interface CatalogueServiceSummary {
  description: string | null;
  name: string;
  pricingConfiguration: unknown;
  quantityConfiguration: unknown;
}

export function filterCatalogueServices<T extends Pick<CatalogueServiceSummary, "description" | "name">>(
  services: readonly T[],
  query: string,
) {
  const normalized = query.normalize("NFKC").trim().toLocaleLowerCase("en");
  if (!normalized) return [...services];
  return services.filter((service) =>
    `${service.name} ${service.description ?? ""}`
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .includes(normalized),
  );
}

export function serviceCataloguePriceLabel(service: CatalogueServiceSummary) {
  const pricing = readPricingConfiguration(service.pricingConfiguration);
  if (pricing.mode === "ON_REQUEST") return "Price on Request";

  const strategy = readStrategyPricingConfiguration(service.pricingConfiguration);
  switch (strategy?.profile) {
    case "BANNER_PRINTING":
      return "GH₵4 / sq ft · total by size";
    case "CONTAINER_NUMBER":
      return "GH₵30 / A3 sticker";
    case "FOR_SALE_STICKERS":
      return "From GH₵20 / 2 pcs";
    case "LABEL_PRINTING":
      return "Price based on size and quantity";
    case "POSTER_PRINTING":
      return "From GH₵3 / piece · minimum 4";
    case "STICKER_PRINTING":
      return strategy.strategy === "AREA_BASED"
        ? "GH₵3 / sq ft · total by size"
        : "Price based on your choices";
    default:
      break;
  }

  if (pricing.fixed) {
    const quantity = readQuantityConfiguration(service.quantityConfiguration);
    const unit = quantity?.unit || "items";
    return `From ${formatGhanaCediMinor(BigInt(pricing.fixed.startingPriceMinor))} / ${pricing.fixed.startingQuantity.toLocaleString("en-US")} ${unit}`;
  }
  return "Price calculated from your choices";
}
