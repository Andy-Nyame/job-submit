import assert from "node:assert/strict";
import test from "node:test";

import {
  validateQuantityConfiguration,
  validateSpecificationConfiguration,
} from "./service-configuration";
import { validatePricingConfiguration } from "./service-pricing";
import { SERVICE_BLUEPRINTS } from "./service-blueprints";
import {
  assertCanSubmitCustomerJob,
  JobSubmissionValidationError,
  validateJobSubmission,
  type JobSubmissionPayload,
  type SubmissionService,
} from "./job-submission";

const serviceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const idempotencyKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function service(overrides: Partial<SubmissionService> = {}): SubmissionService {
  return {
    defaultComplexity: null,
    defaultWorkloadClass: null,
    description: "A configured service.",
    id: serviceId,
    isActive: true,
    name: "Configured Service",
    onlineSubmissionEnabled: true,
    pricingConfiguration: { fixed: null, mode: "ON_REQUEST", version: 1 },
    quantityConfiguration: null,
    slug: "configured-service",
    specificationConfiguration: null,
    version: 3,
    ...overrides,
  };
}

function payload(overrides: Partial<JobSubmissionPayload> = {}): JobSubmissionPayload {
  return {
    attachments: [],
    idempotencyKey,
    instructions: "Please review the supplied wording.",
    priority: "REGULAR",
    quantity: "",
    selection: {
      finishing: "",
      jobFields: {},
      material: "",
      size: { height: "", kind: "NONE", option: "", unit: "", width: "" },
      variations: [],
    },
    serviceId,
    title: "October print request",
    ...overrides,
  };
}

test("only an active CUSTOMER role may enter customer submission policy", () => {
  assert.doesNotThrow(() => assertCanSubmitCustomerJob("CUSTOMER"));
  for (const role of ["WORKER", "ADMIN", "OWNER"] as const) {
    assert.throws(() => assertCanSubmitCustomerJob(role), JobSubmissionValidationError);
  }
});

test("active online services accept Price on Request without fabricating a total", () => {
  const result = validateJobSubmission(payload(), service());
  assert.equal(result.snapshot.pricing.mode, "ON_REQUEST");
  assert.equal(result.snapshot.pricing.quotePending, true);
  assert.equal(result.quantity, null);
  assert.equal(result.complexity, null);
  assert.equal(result.workloadClass, null);
});

test("inactive and online-disabled services are rejected authoritatively", () => {
  assert.throws(
    () => validateJobSubmission(payload(), service({ isActive: false })),
    JobSubmissionValidationError,
  );
  assert.throws(
    () => validateJobSubmission(payload(), service({ onlineSubmissionEnabled: false })),
    JobSubmissionValidationError,
  );
});

test("fixed Regular and Express prices are recalculated from service configuration", () => {
  const quantity = validateQuantityConfiguration({
    increment: "5",
    maximum: "100",
    minimum: "10",
    presets: "10,20",
    unit: "pieces",
  });
  const pricing = validatePricingConfiguration(
    {
      additionalStepPrice: "2.00",
      coverage: "Configured material and finish",
      mode: "FIXED",
      startingPrice: "10.00",
      startingQuantity: "10",
    },
    quantity,
  );
  const configured = service({
    pricingConfiguration: pricing,
    quantityConfiguration: quantity,
  });
  const regular = validateJobSubmission(payload({ quantity: "20" }), configured);
  assert.equal(regular.snapshot.pricing.mode, "FIXED");
  assert.equal(regular.snapshot.pricing.mode === "FIXED" && regular.snapshot.pricing.totalMinor, "1400");

  const express = validateJobSubmission(
    payload({ priority: "EXPRESS", quantity: "20" }),
    configured,
  );
  assert.equal(express.snapshot.pricing.mode, "FIXED");
  assert.equal(express.snapshot.pricing.mode === "FIXED" && express.snapshot.pricing.expressSurchargeMinor, "560");
  assert.equal(express.snapshot.pricing.mode === "FIXED" && express.snapshot.pricing.totalMinor, "1960");
});

test("client-supplied pricing fields are rejected instead of trusted", () => {
  assert.throws(
    () =>
      validateJobSubmission(
        { ...payload(), priceMinor: "1" },
        service(),
      ),
    (error: unknown) =>
      error instanceof JobSubmissionValidationError &&
      error.code === "TAMPERED_PRICE",
  );
});

test("batch numbers remain exact text and custom dimensions use configured units", () => {
  const specification = validateSpecificationConfiguration({
    artworkRequirement: "EITHER",
    customDimensionUnits: ["CM"],
    customFields: [
      {
        helpText: "Preserve letters and leading zeroes.",
        id: "batch-number",
        label: "Batch number",
        maxLength: "80",
        options: "",
        required: true,
        scope: "JOB",
        type: "SHORT_TEXT",
      },
    ],
    customInstructions: "",
    finishingOptions: "",
    finishingRequired: false,
    fixedSizeHeight: "",
    fixedSizeUnit: "",
    fixedSizeWidth: "",
    materialOptions: "",
    materialsRequired: false,
    sizeMode: "CUSTOM",
    standardSizeOptions: "",
    variationsEnabled: false,
  });
  const result = validateJobSubmission(
    payload({
      selection: {
        ...payload().selection,
        jobFields: { "batch-number": "AB-001/Oct" },
        size: { height: "20.5", kind: "CUSTOM", option: "", unit: "CM", width: "10" },
      },
    }),
    service({ specificationConfiguration: specification }),
  );
  assert.equal(result.snapshot.request.jobFields["batch-number"], "AB-001/Oct");
  assert.deepEqual(result.snapshot.request.size, {
    height: "20.5",
    kind: "CUSTOM",
    unit: "CM",
    width: "10",
  });
});

test("variation quantities use their combined total and preserve scoped values", () => {
  const quantity = validateQuantityConfiguration({
    increment: "5",
    maximum: "50",
    minimum: "5",
    presets: "5,10",
    unit: "stickers",
  });
  const specification = validateSpecificationConfiguration({
    artworkRequirement: "NOT_REQUIRED",
    customDimensionUnits: [],
    customFields: [
      {
        helpText: "",
        id: "variation-wording",
        label: "Wording",
        maxLength: "80",
        options: "",
        required: true,
        scope: "VARIATION",
        type: "SHORT_TEXT",
      },
    ],
    customInstructions: "",
    finishingOptions: "",
    finishingRequired: false,
    fixedSizeHeight: "",
    fixedSizeUnit: "",
    fixedSizeWidth: "",
    materialOptions: "",
    materialsRequired: false,
    sizeMode: "NO_SIZE",
    standardSizeOptions: "",
    variationsEnabled: true,
  });
  const result = validateJobSubmission(
    payload({
      selection: {
        ...payload().selection,
        variations: [
          { fieldValues: { "variation-wording": "First" }, id: "one", quantity: 2 },
          { fieldValues: { "variation-wording": "Second" }, id: "two", quantity: 3 },
        ],
      },
    }),
    service({ quantityConfiguration: quantity, specificationConfiguration: specification }),
  );
  assert.equal(result.quantity, 5);
  assert.equal(result.snapshot.request.variations[1].fieldValues["variation-wording"], "Second");
});

test("technical proof is never required, while configured customer artwork is", () => {
  const optionalArtwork = validateSpecificationConfiguration({
    artworkRequirement: "EITHER",
    customDimensionUnits: [],
    customFields: [],
    customInstructions: "",
    finishingOptions: "",
    finishingRequired: false,
    fixedSizeHeight: "",
    fixedSizeUnit: "",
    fixedSizeWidth: "",
    materialOptions: "",
    materialsRequired: false,
    sizeMode: "NO_SIZE",
    standardSizeOptions: "",
    variationsEnabled: false,
  });
  assert.doesNotThrow(() =>
    validateJobSubmission(
      payload(),
      service({ specificationConfiguration: optionalArtwork }),
    ),
  );

  const requiredArtwork = { ...optionalArtwork!, artworkRequirement: "CUSTOMER_PROVIDED" as const };
  assert.throws(() =>
    validateJobSubmission(
      payload(),
      service({ specificationConfiguration: requiredArtwork }),
    ),
  );
});

test("duplicate upload references and malformed idempotency keys are rejected", () => {
  const attachment = {
    originalFilename: "reference.pdf",
    pathname: "jobsubmit/customer-staging/cccccccc-cccc-4ccc-8ccc-cccccccccccc/reference.pdf",
    uploadId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  };
  assert.throws(() =>
    validateJobSubmission(
      payload({ attachments: [attachment, attachment] }),
      service(),
    ),
  );
  assert.throws(() =>
    validateJobSubmission(payload({ idempotencyKey: "not-a-uuid" }), service()),
  );
});

test("approved For Sale pricing is server-authoritative and preserves printed leading zeros", () => {
  const blueprint = SERVICE_BLUEPRINTS.FOR_SALE_STICKERS;
  const result = validateJobSubmission(
    payload({
      quantity: "4",
      selection: {
        ...payload().selection,
        jobFields: {
          "printed-contact-1": "0240012345",
          "printed-contact-count": "1",
        },
        size: { height: "", kind: "PRESET", option: "A4", unit: "", width: "" },
      },
    }),
    service({
      pricingConfiguration: blueprint.pricing,
      quantityConfiguration: blueprint.quantity,
      specificationConfiguration: blueprint.specification,
    }),
  );
  assert.equal(result.snapshot.pricing.mode, "FIXED");
  assert.equal(result.snapshot.pricing.mode === "FIXED" && result.snapshot.pricing.totalMinor, "4000");
  assert.equal(result.snapshot.request.jobFields["printed-contact-1"], "0240012345");
});

test("linked Designing safely replaces the initial finished-artwork requirement", () => {
  const blueprint = SERVICE_BLUEPRINTS.BANNER_PRINTING;
  const configured = service({
    pricingConfiguration: blueprint.pricing,
    quantityConfiguration: blueprint.quantity,
    specificationConfiguration: blueprint.specification,
  });
  const request = payload({
    linkedDesignServiceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    quantity: "1",
    selection: {
      ...payload().selection,
      size: { height: "3", kind: "CUSTOM", option: "", unit: "FEET", width: "2" },
    },
  });
  assert.doesNotThrow(() => validateJobSubmission(request, configured));
  assert.throws(() => validateJobSubmission({ ...request, linkedDesignServiceId: undefined }, configured));
});
