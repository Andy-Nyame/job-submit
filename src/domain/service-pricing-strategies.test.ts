import assert from "node:assert/strict";
import test from "node:test";

import { SERVICE_BLUEPRINTS } from "./service-blueprints";
import { calculateStrategyPrice, readStrategyPricingConfiguration, roundUpToFiveCedisMinor } from "./service-pricing-strategies";

function price(profile: "BANNER_PRINTING" | "CONTAINER_NUMBER" | "FOR_SALE_STICKERS" | "STICKER_PRINTING", input: Parameters<typeof calculateStrategyPrice>[1]) {
  const configuration = readStrategyPricingConfiguration(SERVICE_BLUEPRINTS[profile].pricing);
  assert.ok(configuration);
  return calculateStrategyPrice(configuration, input);
}

const none = { kind: "NONE" as const };

test("GH₵5 selling-price rounding always rounds up and preserves exact multiples", () => {
  assert.equal(roundUpToFiveCedisMinor(1_800n), 2_000n);
  assert.equal(roundUpToFiveCedisMinor(2_100n), 2_500n);
  assert.equal(roundUpToFiveCedisMinor(2_500n), 2_500n);
  assert.equal(roundUpToFiveCedisMinor(2_800n), 3_000n);
});

test("For Sale A4 and A3 sticker groups use exact pair pricing", () => {
  const fields = { "printed-contact-count": "1", "printed-contact-1": "0240012345" };
  assert.equal(price("FOR_SALE_STICKERS", { jobFields: fields, quantity: 2, size: { kind: "PRESET", option: "A4" } })?.basePriceMinor, 2_000n);
  assert.equal(price("FOR_SALE_STICKERS", { jobFields: fields, quantity: 4, size: { kind: "PRESET", option: "A4" } })?.basePriceMinor, 4_000n);
  assert.equal(price("FOR_SALE_STICKERS", { jobFields: fields, quantity: 2, size: { kind: "PRESET", option: "A3" } })?.basePriceMinor, 4_000n);
  assert.equal(price("FOR_SALE_STICKERS", { jobFields: fields, quantity: 4, size: { kind: "PRESET", option: "A3" } })?.basePriceMinor, 8_000n);
  assert.equal(price("FOR_SALE_STICKERS", { jobFields: fields, quantity: 3, size: { kind: "PRESET", option: "A4" } }), null);
});

test("For Sale printed contact count requires exactly the selected text values", () => {
  assert.equal(price("FOR_SALE_STICKERS", { jobFields: { "printed-contact-count": "2", "printed-contact-1": "001" }, quantity: 2, size: { kind: "PRESET", option: "A4" } }), null);
  assert.equal(price("FOR_SALE_STICKERS", { jobFields: { "printed-contact-count": "2", "printed-contact-1": "001", "printed-contact-2": "002" }, quantity: 2, size: { kind: "PRESET", option: "A4" } })?.basePriceMinor, 2_000n);
});

test("custom sticker and banner area pricing converts feet and rounds once", () => {
  const size = { height: "3", kind: "CUSTOM" as const, unit: "FEET" as const, width: "2" };
  assert.equal(price("STICKER_PRINTING", { jobFields: { "sticker-product": "Custom-size sticker" }, quantity: 1, size })?.basePriceMinor, 2_000n);
  assert.equal(price("BANNER_PRINTING", { jobFields: {}, quantity: 1, size })?.basePriceMinor, 2_500n);
  assert.equal(price("STICKER_PRINTING", { jobFields: { "sticker-product": "Custom-size sticker" }, quantity: 2, size })?.basePriceMinor, 4_000n);
});

test("label layout charges printing and cutting exactly once", () => {
  const result = price("STICKER_PRINTING", {
    jobFields: { "label-shape": "Square", "sticker-product": "Labels" },
    quantity: 60,
    size: { height: "2", kind: "CUSTOM", unit: "INCHES", width: "2" },
  });
  assert.equal(result?.basePriceMinor, 2_500n);
  assert.deepEqual(result?.internalCalculation, {
    chargedHeightFeet: 1,
    cuttingPriceMinor: "1000",
    heightUsedInches: "9.500",
    labelsPerRow: 18,
    printingPriceMinor: "1500",
    rows: 4,
  });
  assert.equal(price("STICKER_PRINTING", { jobFields: { "label-shape": "Square", "sticker-product": "Labels" }, quantity: 59, size: { height: "2", kind: "CUSTOM", unit: "INCHES", width: "2" } }), null);
  assert.equal(price("STICKER_PRINTING", { jobFields: { "sticker-product": "Labels" }, quantity: 60, size: { height: "2", kind: "CUSTOM", unit: "INCHES", width: "2" } }), null);
});

test("irregular labels safely fall back instead of inventing geometry", () => {
  assert.equal(price("STICKER_PRINTING", { jobFields: { "label-shape": "Custom / irregular", "sticker-product": "Labels" }, quantity: 60, size: { height: "2", kind: "CUSTOM", unit: "INCHES", width: "2" } }), null);
});

test("approved poster variants enforce increments and final price rounding", () => {
  const cases = [["A4", 4, 1_500n], ["A4", 8, 2_500n], ["A3", 4, 2_000n], ["A2", 2, 2_000n], ["A1", 2, 4_000n]] as const;
  for (const [variant, quantity, expected] of cases) {
    assert.equal(price("STICKER_PRINTING", { jobFields: { "sticker-product": "Poster printing" }, quantity, size: { kind: "PRESET", option: variant } })?.basePriceMinor, expected);
  }
  assert.equal(price("STICKER_PRINTING", { jobFields: { "sticker-product": "Poster printing" }, quantity: 5, size: { kind: "PRESET", option: "A4" } }), null);
  const a2 = price("STICKER_PRINTING", { jobFields: { "sticker-product": "Poster printing" }, quantity: 2, size: { kind: "PRESET", option: "A2" } });
  assert.equal(a2?.internalCalculation.approvedWidthInches, 16);
  assert.equal(a2?.internalCalculation.approvedHeightInches, 23);
  assert.equal(a2?.internalCalculation.piecesPerRow, 2);
});

test("container numbers normalize one letter and preserve three digits", () => {
  assert.equal(price("CONTAINER_NUMBER", { jobFields: { "container-number": "c001" }, quantity: 1, size: none })?.basePriceMinor, 3_000n);
  for (const value of ["A12", "1234", "AB12"]) {
    assert.equal(price("CONTAINER_NUMBER", { jobFields: { "container-number": value }, quantity: 1, size: none }), null);
  }
});
