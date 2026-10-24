import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanManageOperations,
  assertProductionTransition,
  canManageOperations,
  compareQueueJobs,
  hasConfirmedOperationalPrice,
  JobOperationsPolicyError,
  normalizeOperationReason,
  pickupChecklistComplete,
  validatePackageCount,
} from "./job-operations";

function snapshot(mode: "FIXED" | "ON_REQUEST") {
  return {
    pricing: mode === "FIXED" ? { mode: "FIXED" } : { mode: "ON_REQUEST" },
    request: {},
    service: {},
    version: 1,
  };
}

test("only Owner and Admin have queue management authority", () => {
  for (const role of ["OWNER", "ADMIN"] as const) {
    assert.equal(canManageOperations(role), true);
    assert.doesNotThrow(() => assertCanManageOperations(role));
  }
  for (const role of ["WORKER", "CUSTOMER"] as const) {
    assert.equal(canManageOperations(role), false);
    assert.throws(() => assertCanManageOperations(role), JobOperationsPolicyError);
  }
});

test("fixed snapshots and accepted manual quotations are eligible but pending pricing is not", () => {
  assert.equal(hasConfirmedOperationalPrice({ acceptedQuotationExists: false, submissionSnapshot: snapshot("FIXED") }), true);
  assert.equal(hasConfirmedOperationalPrice({ acceptedQuotationExists: true, submissionSnapshot: snapshot("ON_REQUEST") }), true);
  assert.equal(hasConfirmedOperationalPrice({ acceptedQuotationExists: false, submissionSnapshot: snapshot("ON_REQUEST") }), false);
  assert.equal(hasConfirmedOperationalPrice({ acceptedQuotationExists: true, submissionSnapshot: null }), false);
});

test("queue order is Express first then override tier then FIFO", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  const later = new Date("2026-10-24T11:00:00Z");
  assert.ok(compareQueueJobs({ priority: "EXPRESS", queueEnteredAt: later }, { priority: "REGULAR", queueEnteredAt: now }) < 0);
  assert.ok(compareQueueJobs({ priority: "REGULAR", queueEnteredAt: now }, { priority: "REGULAR", queueEnteredAt: later }) < 0);
  assert.ok(compareQueueJobs({ priority: "REGULAR", queueEnteredAt: later, queueOrderTier: -1 }, { priority: "REGULAR", queueEnteredAt: now }) < 0);
});

test("production transitions are explicit and cannot skip secure pickup", () => {
  for (const [from, to] of [
    ["ACCEPTED", "QUEUED"],
    ["QUEUED", "PROCESSING"],
    ["PROCESSING", "PREPARING_FOR_PICKUP"],
    ["PREPARING_FOR_PICKUP", "READY_FOR_PICKUP"],
    ["READY_FOR_PICKUP", "PICKED_UP"],
  ] as const) assert.doesNotThrow(() => assertProductionTransition(from, to));
  assert.throws(() => assertProductionTransition("QUEUED", "READY_FOR_PICKUP"), JobOperationsPolicyError);
  assert.throws(() => assertProductionTransition("PROCESSING", "PICKED_UP"), JobOperationsPolicyError);
});

test("package counts, exception reasons, and pickup checks fail closed", () => {
  assert.equal(validatePackageCount(3), 3);
  for (const value of [0, 101, 1.5]) assert.throws(() => validatePackageCount(value), JobOperationsPolicyError);
  assert.equal(normalizeOperationReason("  Customer delivery exception. "), "Customer delivery exception.");
  assert.throws(() => normalizeOperationReason("no"), JobOperationsPolicyError);
  assert.equal(pickupChecklistComplete({ collectorVerified: true, correctJob: true, correctSpecifications: true, packagesPresent: true }), true);
  assert.equal(pickupChecklistComplete({ collectorVerified: true, correctJob: true, correctSpecifications: false, packagesPresent: true }), false);
});
