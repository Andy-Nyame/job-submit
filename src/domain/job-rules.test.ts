import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateExpressPrice,
  calculateSurchargeMinor,
  starsForComplexity,
} from "./job-rules";

test("Express pricing adds exactly 40 percent using minor units", () => {
  assert.deepEqual(calculateExpressPrice(10_000n), {
    basePriceMinor: 10_000n,
    surchargeBasisPoints: 4_000n,
    surchargeMinor: 4_000n,
    totalMinor: 14_000n,
  });
});

test("minor-unit surcharge arithmetic rounds half up", () => {
  assert.equal(calculateSurchargeMinor(1n, 4_000n), 0n);
  assert.equal(calculateSurchargeMinor(2n, 4_000n), 1n);
  assert.equal(calculateSurchargeMinor(123n, 4_000n), 49n);
});

test("negative pricing inputs are rejected", () => {
  assert.throws(() => calculateExpressPrice(-1n), RangeError);
  assert.throws(() => calculateSurchargeMinor(100n, -1n), RangeError);
});

test("complexity maps to the permanent star defaults", () => {
  assert.equal(starsForComplexity("SIMPLE"), 1);
  assert.equal(starsForComplexity("MEDIUM"), 2);
  assert.equal(starsForComplexity("COMPLEX"), 3);
});
