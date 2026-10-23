import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanManageQuotations,
  assertQuotationTransition,
  canManageQuotations,
  effectiveQuotationStatus,
  quotationExpiryFromDays,
  QuotationPolicyError,
  readQuotationLineItems,
  validateCounteroffer,
  validateQuotationTerms,
} from "./quotation-policy";

test("quotation pricing authority is limited to OWNER and ADMIN", () => {
  assert.equal(canManageQuotations("OWNER"), true);
  assert.equal(canManageQuotations("ADMIN"), true);
  assert.equal(canManageQuotations("WORKER"), false);
  assert.equal(canManageQuotations("CUSTOMER"), false);
  assert.throws(() => assertCanManageQuotations("WORKER"), QuotationPolicyError);
});

test("regular itemized quotation uses exact integer-pesewa totals", () => {
  const terms = validateQuotationTerms(
    [
      { amount: "120.25", description: "Production work", kind: "BASE" },
      { amount: "10.00", description: "Finishing", kind: "ADDITIONAL" },
    ],
    "REGULAR",
  );
  assert.equal(terms.subtotalMinor, 13_025n);
  assert.equal(terms.expressSurchargeMinor, 0n);
  assert.equal(terms.totalMinor, 13_025n);
});

test("Express quotation adds exactly one 40 percent surcharge", () => {
  const terms = validateQuotationTerms(
    [{ amount: "100.00", description: "Confirmed base work", kind: "BASE" }],
    "EXPRESS",
  );
  assert.equal(terms.expressSurchargeBasisPoints, 4_000);
  assert.equal(terms.expressSurchargeMinor, 4_000n);
  assert.equal(terms.totalMinor, 14_000n);
  assert.equal(terms.lineItems.length, 1);
});

test("quotation lines reject zero, malformed amounts, and unsafe descriptions", () => {
  for (const item of [
    { amount: "0", description: "Work", kind: "BASE" },
    { amount: "1.999", description: "Work", kind: "BASE" },
    { amount: "10", description: "", kind: "BASE" },
    { amount: "10", description: "Work", kind: "DISCOUNT" },
  ]) {
    assert.throws(
      () => validateQuotationTerms([item], "REGULAR"),
      QuotationPolicyError,
    );
  }
});

test("issued terms round-trip only through the strict line-item reader", () => {
  const terms = validateQuotationTerms(
    [{ amount: "12.50", description: "Artwork preparation", kind: "BASE" }],
    "REGULAR",
  );
  assert.deepEqual(readQuotationLineItems(terms.lineItems), terms.lineItems);
  assert.deepEqual(readQuotationLineItems([{ amountMinor: 1250, description: "Bad", kind: "BASE" }]), []);
});

test("quotation validity defaults can be bounded deterministically", () => {
  const now = new Date("2026-10-23T00:00:00.000Z");
  assert.equal(
    quotationExpiryFromDays(7, now).toISOString(),
    "2026-10-30T00:00:00.000Z",
  );
  assert.throws(() => quotationExpiryFromDays(0, now), QuotationPolicyError);
  assert.throws(() => quotationExpiryFromDays(91, now), QuotationPolicyError);
});

test("an overdue issued quotation has an effective expired state", () => {
  const now = new Date("2026-10-23T12:00:00.000Z");
  assert.equal(
    effectiveQuotationStatus("ISSUED", new Date("2026-10-23T11:59:59.000Z"), now),
    "EXPIRED",
  );
  assert.equal(
    effectiveQuotationStatus("ACCEPTED", new Date("2026-10-01T00:00:00.000Z"), now),
    "ACCEPTED",
  );
});

test("quotation transitions reject editing or reaccepting terminal versions", () => {
  assert.doesNotThrow(() => assertQuotationTransition("DRAFT", "ISSUED"));
  assert.doesNotThrow(() => assertQuotationTransition("ISSUED", "ACCEPTED"));
  assert.doesNotThrow(() => assertQuotationTransition("ISSUED", "SUPERSEDED"));
  assert.throws(() => assertQuotationTransition("ACCEPTED", "ISSUED"), QuotationPolicyError);
  assert.throws(() => assertQuotationTransition("DECLINED", "ACCEPTED"), QuotationPolicyError);
});

test("counteroffers are validated as proposals without changing quote totals", () => {
  assert.deepEqual(validateCounteroffer("75.50", "Please review this amount."), {
    amountMinor: 7_550n,
    customerNote: "Please review this amount.",
  });
  assert.throws(() => validateCounteroffer("0", ""), QuotationPolicyError);
  assert.throws(() => validateCounteroffer("not-money", ""), QuotationPolicyError);
});
