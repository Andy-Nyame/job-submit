import assert from "node:assert/strict";
import test from "node:test";

import {
  formatIndicativePriceRange,
  INDICATIVE_PRICE_DISCLAIMER,
  isQuantityAllowed,
  readQuantityConfiguration,
  readSpecificationConfiguration,
  ServiceConfigurationError,
  validateIndicativePrice,
  validateQuantityConfiguration,
  validateSpecificationConfiguration,
} from "./service-configuration";

const blankQuantity = {
  increment: "",
  maximum: "",
  minimum: "",
  presets: "",
  unit: "",
};

const blankSpecification = {
  artworkRequirement: "",
  customDimensionsEnabled: false,
  customDimensionsRequired: false,
  customInstructions: "",
  dimensionUnits: [] as string[],
  finishingOptions: "",
  finishingRequired: false,
  materialOptions: "",
  materialsRequired: false,
  sizeOptions: "",
  sizesRequired: false,
};

test("quantity rules may be left entirely blank", () => {
  assert.equal(validateQuantityConfiguration(blankQuantity), null);
  assert.equal(isQuantityAllowed(1, null), true);
  assert.equal(isQuantityAllowed(0, null), false);
});

test("minimum, maximum, unit and ascending presets are normalized", () => {
  const configuration = validateQuantityConfiguration({
    increment: "",
    maximum: "500",
    minimum: "50",
    presets: "50, 100, 200, 500",
    unit: "  pieces ",
  });
  assert.deepEqual(configuration, {
    increment: null,
    maximum: 500,
    minimum: 50,
    presets: [50, 100, 200, 500],
    unit: "pieces",
    version: 1,
  });
  assert.equal(isQuantityAllowed(75, configuration), true);
  assert.equal(isQuantityAllowed(501, configuration), false);
});

test("a maximum below the minimum is rejected", () => {
  assert.throws(
    () =>
      validateQuantityConfiguration({
        ...blankQuantity,
        maximum: "49",
        minimum: "50",
        unit: "copies",
      }),
    ServiceConfigurationError,
  );
});

test("zero, negative, fractional and excessive quantity values are rejected", () => {
  for (const minimum of ["0", "-1", "1.5", "1000001", "1e2"]) {
    assert.throws(
      () =>
        validateQuantityConfiguration({
          ...blankQuantity,
          minimum,
          unit: "sheets",
        }),
      ServiceConfigurationError,
    );
  }
});

test("increments consistently advance from the configured minimum", () => {
  const configuration = validateQuantityConfiguration({
    increment: "25",
    maximum: "150",
    minimum: "50",
    presets: "50,75,100,150",
    unit: "pieces",
  });
  assert.equal(isQuantityAllowed(50, configuration), true);
  assert.equal(isQuantityAllowed(75, configuration), true);
  assert.equal(isQuantityAllowed(60, configuration), false);
});

test("an increment without a minimum uses the increment as its baseline", () => {
  const configuration = validateQuantityConfiguration({
    ...blankQuantity,
    increment: "50",
    unit: "copies",
  });
  assert.equal(isQuantityAllowed(50, configuration), true);
  assert.equal(isQuantityAllowed(100, configuration), true);
  assert.equal(isQuantityAllowed(1, configuration), false);
});

test("duplicate, descending and constraint-breaking presets are rejected", () => {
  for (const presets of ["50,50", "100,50", "25,50", "50,60"]) {
    assert.throws(
      () =>
        validateQuantityConfiguration({
          increment: "25",
          maximum: "100",
          minimum: "50",
          presets,
          unit: "pieces",
        }),
      ServiceConfigurationError,
    );
  }
});

test("presets remain shortcuts and do not restrict other valid custom quantities", () => {
  const configuration = validateQuantityConfiguration({
    increment: "10",
    maximum: "200",
    minimum: "50",
    presets: "50,100,200",
    unit: "sets",
  });
  assert.equal(isQuantityAllowed(70, configuration), true);
  assert.equal(configuration?.presets.includes(70), false);
});

test("service specification options are normalized and required states retained", () => {
  const configuration = validateSpecificationConfiguration({
    ...blankSpecification,
    artworkRequirement: "EITHER",
    finishingOptions: "Cutting\nBinding",
    materialOptions: "Paper\nWhite SAV",
    materialsRequired: true,
    sizeOptions: "A4\nA3",
    sizesRequired: true,
  });
  assert.deepEqual(configuration?.sizes, {
    options: ["A4", "A3"],
    required: true,
  });
  assert.deepEqual(configuration?.materials.options, ["Paper", "White SAV"]);
  assert.equal(configuration?.artworkRequirement, "EITHER");
});

test("custom dimensions require an allowed measurement unit", () => {
  assert.throws(
    () =>
      validateSpecificationConfiguration({
        ...blankSpecification,
        customDimensionsEnabled: true,
      }),
    ServiceConfigurationError,
  );
  const configuration = validateSpecificationConfiguration({
    ...blankSpecification,
    customDimensionsEnabled: true,
    customDimensionsRequired: true,
    dimensionUnits: ["CM", "INCHES"],
  });
  assert.deepEqual(configuration?.customDimensions, {
    enabled: true,
    required: true,
    units: ["CM", "INCHES"],
  });
});

test("required options cannot be empty and duplicate options are rejected", () => {
  assert.throws(
    () =>
      validateSpecificationConfiguration({
        ...blankSpecification,
        sizesRequired: true,
      }),
    ServiceConfigurationError,
  );
  assert.throws(
    () =>
      validateSpecificationConfiguration({
        ...blankSpecification,
        materialOptions: "Paper\npaper",
      }),
    ServiceConfigurationError,
  );
});

test("malicious markup and invalid artwork values are rejected", () => {
  assert.throws(
    () =>
      validateSpecificationConfiguration({
        ...blankSpecification,
        customInstructions: "<script>alert(1)</script>",
      }),
    ServiceConfigurationError,
  );
  assert.throws(
    () =>
      validateSpecificationConfiguration({
        ...blankSpecification,
        artworkRequirement: "SOMETIMES",
      }),
    ServiceConfigurationError,
  );
});

test("service-specific configurations stay isolated", () => {
  const sticker = validateSpecificationConfiguration({
    ...blankSpecification,
    materialOptions: "White SAV",
  });
  const document = validateSpecificationConfiguration({
    ...blankSpecification,
    materialOptions: "Paper",
  });
  assert.deepEqual(sticker?.materials.options, ["White SAV"]);
  assert.deepEqual(document?.materials.options, ["Paper"]);
  assert.notStrictEqual(sticker, document);
});

test("stored configurations require the supported snapshot version", () => {
  assert.equal(readQuantityConfiguration({ unit: "pieces", version: 2 }), null);
  assert.equal(
    readSpecificationConfiguration({
      artworkRequirement: "NOT_REQUIRED",
      version: 2,
    }),
    null,
  );
});

test("indicative price guidance may be blank or an exact valid GH₵ range", () => {
  assert.deepEqual(
    validateIndicativePrice({ description: "", maximum: "", minimum: "" }),
    { description: null, maximumMinor: null, minimumMinor: null },
  );
  assert.deepEqual(
    validateIndicativePrice({
      description: "For the configured material and size.",
      maximum: "150.50",
      minimum: "50",
    }),
    {
      description: "For the configured material and size.",
      maximumMinor: 15_050n,
      minimumMinor: 5_000n,
    },
  );
});

test("incomplete, malformed, negative and reversed price ranges are rejected", () => {
  const invalidRanges = [
    { description: "", maximum: "", minimum: "10" },
    { description: "", maximum: "20", minimum: "" },
    { description: "", maximum: "10", minimum: "20" },
    { description: "", maximum: "20", minimum: "-1" },
    { description: "", maximum: "20.999", minimum: "10" },
    { description: "Context without a range", maximum: "", minimum: "" },
  ];
  for (const range of invalidRanges) {
    assert.throws(() => validateIndicativePrice(range), ServiceConfigurationError);
  }
});

test("price presentation is explicitly an estimate and performs no job calculation", () => {
  const price = validateIndicativePrice({
    description: "",
    maximum: "100",
    minimum: "50",
  });
  assert.equal(formatIndicativePriceRange(5_000n, 10_000n), "GH₵50.00 – GH₵100.00");
  assert.equal(
    INDICATIVE_PRICE_DISCLAIMER,
    "Estimated price range only. Final pricing is confirmed privately after job review.",
  );
  assert.equal("confirmedTotalMinor" in price, false);
});
