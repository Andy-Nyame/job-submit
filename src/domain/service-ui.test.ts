import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicServiceCard } from "@/components/home/public-service-card";
import { PublicServicesSection } from "@/components/home/public-services-section";
import { ServiceCustomerPreview } from "@/components/services/service-customer-preview";
import { ServiceFormFields, type ServiceFormValues } from "@/components/services/service-form-fields";
import { priceOnRequestConfiguration, validatePricingConfiguration } from "./service-pricing";
import { validateQuantityConfiguration } from "./service-configuration";

const blankValues: ServiceFormValues = {
  allowPriceNegotiation: false,
  additionalStepPrice: "",
  artworkRequirement: "",
  customDimensionUnits: [],
  customFields: [],
  customInstructions: "",
  defaultComplexity: null,
  description: "",
  finishingOptions: "",
  finishingRequired: false,
  fixedPriceCoverage: "",
  fixedSizeHeight: "",
  fixedSizeUnit: "",
  fixedSizeWidth: "",
  isActive: true,
  materialOptions: "",
  materialsRequired: false,
  name: "",
  onlineSubmissionEnabled: false,
  pricingMode: "ON_REQUEST",
  quantityIncrement: "",
  quantityMaximum: "",
  quantityMinimum: "",
  quantityPresets: "",
  quantityUnit: "",
  sizeMode: "NO_SIZE",
  standardSizeOptions: "",
  startingPrice: "",
  startingQuantity: "",
  variationsEnabled: false,
};

test("simplified service form uses manager-friendly sections and hides retired controls", () => {
  const markup = renderToStaticMarkup(createElement(ServiceFormFields, { includeActiveState: true, prefix: "test-service", values: blankValues }));
  for (const heading of ["Basic Information", "Quantity &amp; Pricing", "Sizes &amp; Printing Options", "Customer Information", "Job Difficulty", "Availability"]) assert.match(markup, new RegExp(heading));
  assert.match(markup, /Price on request/);
  assert.match(markup, /Allow price negotiation/);
  assert.match(markup, /Add customer field/);
  assert.doesNotMatch(markup, /Display order|Proof Requirement|Indicative price|Estimated price|Workload class/i);
});

test("customer preview shows a minimum without fabricating a maximum", () => {
  const quantity = validateQuantityConfiguration({ increment: "5", maximum: "", minimum: "5", presets: "5,10", unit: "pieces" });
  const markup = renderToStaticMarkup(createElement(ServiceCustomerPreview, {
    description: "A configured service.",
    name: "Sticker Printing",
    onlineSubmissionEnabled: false,
    pricing: priceOnRequestConfiguration(),
    quantity,
    specification: null,
  }));
  assert.match(markup, /Minimum order: 5 pieces/);
  assert.match(markup, /Multiples of 5/);
  assert.match(markup, /Price on request/);
  assert.doesNotMatch(markup, /maximum|estimated price/i);
});

test("customer preview presents exact fixed-price coverage without a checkout action", () => {
  const quantity = validateQuantityConfiguration({ increment: "5", maximum: "", minimum: "5", presets: "", unit: "pieces" });
  const pricing = validatePricingConfiguration({ additionalStepPrice: "17.35", coverage: "One configured material and uniform size.", mode: "FIXED", startingPrice: "20.10", startingQuantity: "5" }, quantity);
  const markup = renderToStaticMarkup(createElement(ServiceCustomerPreview, {
    description: null,
    name: "Configured Service",
    onlineSubmissionEnabled: true,
    pricing,
    quantity,
    specification: null,
  }));
  assert.match(markup, /5 pieces: GH₵20.10/);
  assert.match(markup, /Each additional 5: \+GH₵17.35/);
  assert.match(markup, /Covers: One configured material/);
  assert.doesNotMatch(markup, /checkout|place order|estimated price/i);
});

test("homepage service card renders accurate compact pricing and availability", () => {
  const markup = renderToStaticMarkup(createElement(PublicServiceCard, {
    service: {
      description: null,
      name: "Container Head & Batch Number Printing",
      onlineSubmissionEnabled: false,
      pricingConfiguration: null,
      quantityConfiguration: { increment: 5, maximum: null, minimum: 5, presets: [5, 10], unit: "pieces", version: 1 },
      slug: "container-head-sticker-batch-numbers-printing",
      specificationConfiguration: null,
    },
  }));
  assert.match(markup, /Price on Request/);
  assert.match(markup, /Not available online/);
  assert.match(markup, /aspect-\[4\/5\]/);
  assert.doesNotMatch(markup, /undefined|Estimated price range/i);
});

test("homepage service catalogue failure state is semantic and uses defined theme utilities", () => {
  const markup = renderToStaticMarkup(
    createElement(PublicServicesSection, { result: { status: "unavailable" } }),
  );
  assert.match(markup, /role="status"/);
  assert.match(markup, /temporarily unavailable/);
  assert.match(markup, /bg-surface/);
  assert.match(markup, /text-muted/);
  assert.doesNotMatch(markup, /undefined/);
});
