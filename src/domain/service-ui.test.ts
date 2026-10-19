import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ServiceCustomerPreview } from "@/components/services/service-customer-preview";
import { ServiceFormFields } from "@/components/services/service-form-fields";

test("customer preview renders estimate disclaimer and offline availability", () => {
  const markup = renderToStaticMarkup(
    createElement(ServiceCustomerPreview, {
      description: "A configured service.",
      indicativePriceDescription: "For standard material.",
      indicativePriceMaximum: 10_000n,
      indicativePriceMinimum: 5_000n,
      name: "Sticker Printing",
      onlineSubmissionEnabled: false,
      quantity: null,
      specification: null,
    }),
  );
  assert.match(markup, /Estimated price range only/);
  assert.match(markup, /not enabled for online submission/);
  assert.doesNotMatch(markup, /checkout|place order/i);
});

test("service form exposes advanced labelled fields without display order", () => {
  const markup = renderToStaticMarkup(
    createElement(ServiceFormFields, {
      includeActiveState: true,
      prefix: "test-service",
      values: {
        artworkRequirement: "",
        customDimensionsEnabled: false,
        customDimensionsRequired: false,
        customInstructions: "",
        defaultComplexity: null,
        defaultWorkloadClass: null,
        description: "",
        dimensionUnits: [],
        finishingOptions: "",
        finishingRequired: false,
        indicativePriceDescription: "",
        indicativePriceMaximum: "",
        indicativePriceMinimum: "",
        isActive: true,
        materialOptions: "",
        materialsRequired: false,
        name: "",
        onlineSubmissionEnabled: false,
        proofRequiredByDefault: null,
        quantityIncrement: "",
        quantityMaximum: "",
        quantityMinimum: "",
        quantityPresets: "",
        quantityUnit: "",
        sizeOptions: "",
        sizesRequired: false,
      },
    }),
  );
  assert.match(markup, /Quantity unit/);
  assert.match(markup, /Artwork requirement/);
  assert.match(markup, /Optional price guidance/);
  assert.doesNotMatch(markup, /Display order/i);
});
