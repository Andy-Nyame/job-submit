import assert from "node:assert/strict";
import test from "node:test";

import { validateQuantityConfiguration } from "./service-configuration";
import {
  calculateFixedPrice,
  formatGhanaCediMinor,
  priceOnRequestConfiguration,
  readPricingConfiguration,
  ServicePricingError,
  validatePricingConfiguration,
} from "./service-pricing";

const quantity = validateQuantityConfiguration({
  increment: "5",
  maximum: "100",
  minimum: "5",
  presets: "5,10,15",
  unit: "pieces",
});

test("fixed pricing uses exact starting and additional-step pesewa arithmetic", () => {
  const pricing = validatePricingConfiguration({
    additionalStepPrice: "17.35",
    coverage: "Configured material and one uniform size.",
    mode: "FIXED",
    startingPrice: "20.10",
    startingQuantity: "5",
  }, quantity);
  assert.equal(calculateFixedPrice(pricing, quantity, { hasMixedSpecifications: false, totalQuantity: 5 }), 2_010n);
  assert.equal(calculateFixedPrice(pricing, quantity, { hasMixedSpecifications: false, totalQuantity: 10 }), 3_745n);
  assert.equal(calculateFixedPrice(pricing, quantity, { hasMixedSpecifications: false, totalQuantity: 15 }), 5_480n);
  assert.equal(formatGhanaCediMinor(3_745n), "GH₵37.45");
});

test("fixed pricing can use different starting and step prices", () => {
  const pricing = validatePricingConfiguration({
    additionalStepPrice: "3.25",
    coverage: "The configured standard specification.",
    mode: "FIXED",
    startingPrice: "25.00",
    startingQuantity: "10",
  }, quantity);
  assert.equal(calculateFixedPrice(pricing, quantity, { hasMixedSpecifications: false, totalQuantity: 20 }), 3_150n);
});

test("invalid money, starting quantities and absent increments reject fixed pricing", () => {
  for (const startingPrice of ["-1", "1.999", "NaN", "1000001"])
    assert.throws(() => validatePricingConfiguration({ additionalStepPrice: "1", coverage: "Configured work.", mode: "FIXED", startingPrice, startingQuantity: "5" }, quantity), ServicePricingError);
  assert.throws(() => validatePricingConfiguration({ additionalStepPrice: "1", coverage: "Configured work.", mode: "FIXED", startingPrice: "10", startingQuantity: "6" }, quantity), ServicePricingError);
  const noIncrement = validateQuantityConfiguration({ increment: "", maximum: "", minimum: "5", presets: "", unit: "pieces" });
  assert.throws(() => validatePricingConfiguration({ additionalStepPrice: "1", coverage: "Configured work.", mode: "FIXED", startingPrice: "10", startingQuantity: "5" }, noIncrement), ServicePricingError);
});

test("mixed specifications and invalid quantities do not produce misleading fixed totals", () => {
  const pricing = validatePricingConfiguration({ additionalStepPrice: "20", coverage: "One uniform specification.", mode: "FIXED", startingPrice: "20", startingQuantity: "5" }, quantity);
  assert.equal(calculateFixedPrice(pricing, quantity, { hasMixedSpecifications: true, totalQuantity: 10 }), null);
  assert.equal(calculateFixedPrice(pricing, quantity, { hasMixedSpecifications: false, totalQuantity: 7 }), null);
});

test("Price on Request produces no automatic price", () => {
  const pricing = priceOnRequestConfiguration();
  assert.equal(calculateFixedPrice(pricing, quantity, { hasMixedSpecifications: false, totalQuantity: 10 }), null);
  assert.deepEqual(validatePricingConfiguration({ additionalStepPrice: "", coverage: "", mode: "ON_REQUEST", startingPrice: "", startingQuantity: "" }, quantity), pricing);
});

test("legacy indicative ranges are never interpreted as fixed pricing", () => {
  const legacyOnly = {
    indicativePriceMaxMinor: "10000",
    indicativePriceMinMinor: "5000",
    version: 1,
  };
  assert.deepEqual(readPricingConfiguration(legacyOnly), priceOnRequestConfiguration());
  assert.deepEqual(readPricingConfiguration(null), priceOnRequestConfiguration());
});
