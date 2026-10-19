import assert from "node:assert/strict";
import test from "node:test";

import {
  formatQuantityRule,
  isQuantityAllowed,
  readSpecificationConfiguration,
  ServiceConfigurationError,
  validateCustomerFieldValues,
  validateQuantityConfiguration,
  validateSpecificationConfiguration,
  validateVariationOrder,
  type CustomerFieldConfigurationInput,
  type SpecificationConfigurationInput,
} from "./service-configuration";

const blankQuantity = { increment: "", maximum: "", minimum: "", presets: "", unit: "" };
const blankSpecification: SpecificationConfigurationInput = {
  artworkRequirement: "",
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
};

function field(overrides: Partial<CustomerFieldConfigurationInput> = {}): CustomerFieldConfigurationInput {
  return {
    helpText: "Enter the exact text to print.",
    id: "batch-number",
    label: "Batch Number",
    maxLength: "80",
    options: "",
    required: true,
    scope: "VARIATION",
    type: "SHORT_TEXT",
    ...overrides,
  };
}

test("quantity rules support no minimum, a minimum only, and an optional maximum", () => {
  assert.equal(validateQuantityConfiguration(blankQuantity), null);
  assert.equal(isQuantityAllowed(1, null), true);
  const minimumOnly = validateQuantityConfiguration({ ...blankQuantity, minimum: "5", unit: "pieces" });
  assert.equal(isQuantityAllowed(4, minimumOnly), false);
  assert.equal(isQuantityAllowed(5, minimumOnly), true);
  assert.equal(isQuantityAllowed(500_000, minimumOnly), true);
  assert.equal(formatQuantityRule(minimumOnly), "Minimum order: 5 pieces");
  const bounded = validateQuantityConfiguration({ ...blankQuantity, maximum: "100", minimum: "5", unit: "pieces" });
  assert.equal(formatQuantityRule(bounded), "5–100 pieces");
  assert.equal(isQuantityAllowed(101, bounded), false);
});

test("increments align to the minimum, or to the increment when no minimum exists", () => {
  const fromMinimum = validateQuantityConfiguration({ increment: "5", maximum: "100", minimum: "7", presets: "7, 12, 17", unit: "pieces" });
  assert.equal(isQuantityAllowed(12, fromMinimum), true);
  assert.equal(isQuantityAllowed(10, fromMinimum), false);
  const withoutMinimum = validateQuantityConfiguration({ ...blankQuantity, increment: "5", unit: "copies" });
  assert.equal(isQuantityAllowed(5, withoutMinimum), true);
  assert.equal(isQuantityAllowed(6, withoutMinimum), false);
});

test("invalid quantity bounds and inconsistent presets are rejected", () => {
  for (const input of [
    { ...blankQuantity, minimum: "0", unit: "pieces" },
    { ...blankQuantity, minimum: "-1", unit: "pieces" },
    { ...blankQuantity, minimum: "1.5", unit: "pieces" },
    { ...blankQuantity, maximum: "4", minimum: "5", unit: "pieces" },
    { ...blankQuantity, increment: "5", minimum: "5", presets: "5,5", unit: "pieces" },
    { ...blankQuantity, increment: "5", minimum: "5", presets: "5,9", unit: "pieces" },
  ]) assert.throws(() => validateQuantityConfiguration(input), ServiceConfigurationError);
});

test("quantity presets remain shortcuts rather than the only valid quantities", () => {
  const quantity = validateQuantityConfiguration({ increment: "5", maximum: "100", minimum: "5", presets: "5,25,50", unit: "pieces" });
  assert.equal(isQuantityAllowed(30, quantity), true);
  assert.equal(quantity?.presets.includes(30), false);
});

test("all five size modes validate without inventing dimensions", () => {
  assert.equal(validateSpecificationConfiguration(blankSpecification), null);
  const fixed = validateSpecificationConfiguration({ ...blankSpecification, fixedSizeHeight: "20.5", fixedSizeUnit: "CM", fixedSizeWidth: "10", sizeMode: "FIXED" });
  assert.deepEqual(fixed?.sizes.fixed, { height: "20.5", unit: "CM", width: "10" });
  const preset = validateSpecificationConfiguration({ ...blankSpecification, sizeMode: "PRESET", standardSizeOptions: "Owner size 1\nOwner size 2" });
  assert.deepEqual(preset?.sizes.options, ["Owner size 1", "Owner size 2"]);
  const custom = validateSpecificationConfiguration({ ...blankSpecification, customDimensionUnits: ["MM", "CM"], sizeMode: "CUSTOM" });
  assert.deepEqual(custom?.sizes.customUnits, ["MM", "CM"]);
  const both = validateSpecificationConfiguration({ ...blankSpecification, customDimensionUnits: ["INCHES"], sizeMode: "PRESET_OR_CUSTOM", standardSizeOptions: "Shop size" });
  assert.equal(both?.sizes.mode, "PRESET_OR_CUSTOM");
});

test("invalid fixed dimensions and contradictory size settings are rejected", () => {
  for (const input of [
    { ...blankSpecification, fixedSizeHeight: "10", fixedSizeUnit: "CM", fixedSizeWidth: "0", sizeMode: "FIXED" },
    { ...blankSpecification, sizeMode: "PRESET" },
    { ...blankSpecification, customDimensionUnits: ["CM"], sizeMode: "NO_SIZE" },
    { ...blankSpecification, fixedSizeHeight: "10", fixedSizeUnit: "CM", fixedSizeWidth: "10", sizeMode: "CUSTOM" },
  ]) assert.throws(() => validateSpecificationConfiguration(input), ServiceConfigurationError);
});

test("legacy Brick 5.1 sizes adapt safely to the new size modes", () => {
  const adapted = readSpecificationConfiguration({
    artworkRequirement: "EITHER",
    customDimensions: { enabled: true, required: false, units: ["CM"] },
    customInstructions: null,
    finishing: { options: [], required: false },
    materials: { options: ["Configured material"], required: true },
    sizes: { options: ["Configured size"], required: true },
    version: 1,
  });
  assert.equal(adapted?.sizes.mode, "PRESET_OR_CUSTOM");
  assert.deepEqual(adapted?.sizes.options, ["Configured size"]);
  assert.deepEqual(adapted?.materials.options, ["Configured material"]);
});

test("customer fields support required exact batch text and preserve leading zeros", () => {
  const specification = validateSpecificationConfiguration({ ...blankSpecification, customFields: [field()], variationsEnabled: true });
  assert.ok(specification);
  assert.deepEqual(validateCustomerFieldValues(specification.customerFields, "VARIATION", { "batch-number": "001-A / 7" }), { "batch-number": "001-A / 7" });
  assert.throws(() => validateCustomerFieldValues(specification.customerFields, "VARIATION", {}), ServiceConfigurationError);
});

test("custom field types, scopes, options and help are validated", () => {
  const specification = validateSpecificationConfiguration({
    ...blankSpecification,
    customFields: [
      field({ id: "product-name", label: "Product name", required: false, scope: "JOB" }),
      field({ id: "manufacture-date", label: "Manufacture date", maxLength: "", scope: "JOB", type: "DATE" }),
      field({ id: "choice-field", label: "Configured choice", maxLength: "", options: "Choice A\nChoice B", required: false, scope: "JOB", type: "SELECTION" }),
    ],
  });
  assert.ok(specification);
  const values = validateCustomerFieldValues(specification.customerFields, "JOB", { "manufacture-date": "2026-10-19", "choice-field": "Choice B" });
  assert.equal(values["choice-field"], "Choice B");
});

test("duplicate custom fields, malicious text and inconsistent variation scopes are rejected", () => {
  for (const input of [
    { ...blankSpecification, customFields: [field({ scope: "JOB" }), field({ scope: "JOB" })] },
    { ...blankSpecification, customFields: [field({ id: "unsafe", label: "<script>", scope: "JOB" })] },
    { ...blankSpecification, customFields: [field()], variationsEnabled: false },
  ]) assert.throws(() => validateSpecificationConfiguration(input), ServiceConfigurationError);
});

test("variation quantities are validated against their combined total, not per-item minimums", () => {
  const quantity = validateQuantityConfiguration({ ...blankQuantity, increment: "5", minimum: "5", unit: "pieces" });
  const specification = validateSpecificationConfiguration({ ...blankSpecification, customFields: [field()], variationsEnabled: true });
  assert.ok(specification);
  const order = validateVariationOrder(quantity, specification, [
    { fieldValues: { "batch-number": "A123" }, id: "variation-1", quantity: 2, specificationKey: "same" },
    { fieldValues: { "batch-number": "A124" }, id: "variation-2", quantity: 3, specificationKey: "same" },
  ]);
  assert.equal(order.totalQuantity, 5);
  assert.equal(order.variations[0].fieldValues["batch-number"], "A123");
  assert.equal(order.hasMixedSpecifications, false);
});

test("variation limits, duplicate IDs, invalid totals and mixed specifications are detected", () => {
  const quantity = validateQuantityConfiguration({ ...blankQuantity, increment: "5", minimum: "5", unit: "pieces" });
  const specification = validateSpecificationConfiguration({ ...blankSpecification, variationsEnabled: true });
  assert.ok(specification);
  const mixed = validateVariationOrder(quantity, specification, [
    { fieldValues: {}, id: "one", quantity: 2, specificationKey: "small" },
    { fieldValues: {}, id: "two", quantity: 3, specificationKey: "large" },
  ]);
  assert.equal(mixed.hasMixedSpecifications, true);
  assert.throws(() => validateVariationOrder(quantity, specification, [{ fieldValues: {}, id: "one", quantity: 2 }]), ServiceConfigurationError);
  assert.throws(() => validateVariationOrder(quantity, specification, [{ fieldValues: {}, id: "same", quantity: 2 }, { fieldValues: {}, id: "same", quantity: 3 }]), ServiceConfigurationError);
});
