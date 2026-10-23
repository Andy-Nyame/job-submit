import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanManageStaffJobs,
  assertStaffJobTransition,
  canManageStaffJobs,
  MAX_INTERNAL_NOTE_LENGTH,
  normalizeInternalNote,
  parseStaffJobInboxFilters,
  STAFF_JOB_AUDIT_ACTIONS,
  StaffJobPolicyError,
} from "./staff-job-policy";

test("active staff roles may manage jobs while customers may not", () => {
  for (const role of ["WORKER", "ADMIN", "OWNER"] as const) {
    assert.equal(canManageStaffJobs(role), true);
    assert.doesNotThrow(() => assertCanManageStaffJobs(role));
  }
  assert.equal(canManageStaffJobs("CUSTOMER"), false);
  assert.equal(canManageStaffJobs(null), false);
  assert.throws(() => assertCanManageStaffJobs("CUSTOMER"), StaffJobPolicyError);
});

test("staff inbox filters normalize supported values", () => {
  assert.deepEqual(
    parseStaffJobInboxFilters({
      page: "2",
      priority: "express",
      q: "  JS-2026   Customer  ",
      service: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sort: "updated",
      status: "under_review",
    }),
    {
      page: 2,
      priority: "EXPRESS",
      query: "JS-2026 Customer",
      serviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sort: "UPDATED",
      status: "UNDER_REVIEW",
    },
  );
});

test("empty filters use bounded defaults", () => {
  assert.deepEqual(parseStaffJobInboxFilters({}), {
    page: 1,
    priority: null,
    query: "",
    serviceId: null,
    sort: "NEWEST",
    status: null,
  });
});

test("malformed, duplicate, and excessive filters fail closed", () => {
  for (const input of [
    { page: "0" },
    { priority: "IMMEDIATE" },
    { q: ["one", "two"] },
    { q: "x".repeat(101) },
    { service: "not-a-uuid" },
    { sort: "PRICE" },
    { status: "UNKNOWN" },
  ]) {
    assert.throws(() => parseStaffJobInboxFilters(input), StaffJobPolicyError);
  }
});

test("Brick 6B permits only the initial staff-review transition", () => {
  assert.doesNotThrow(() => assertStaffJobTransition("SUBMITTED", "UNDER_REVIEW"));
  for (const transition of [
    ["UNDER_REVIEW", "UNDER_REVIEW"],
    ["UNDER_REVIEW", "ACCEPTED"],
    ["SUBMITTED", "PROCESSING"],
  ] as const) {
    assert.throws(
      () => assertStaffJobTransition(transition[0], transition[1]),
      StaffJobPolicyError,
    );
  }
});

test("internal notes are normalized, bounded, and use distinct audit events", () => {
  assert.equal(normalizeInternalNote("  Check   colour\r\nwith customer.  "), "Check   colour\nwith customer.");
  assert.throws(() => normalizeInternalNote("   "), StaffJobPolicyError);
  assert.throws(
    () => normalizeInternalNote("x".repeat(MAX_INTERNAL_NOTE_LENGTH + 1)),
    StaffJobPolicyError,
  );
  assert.deepEqual(STAFF_JOB_AUDIT_ACTIONS, {
    NOTE_ADDED: "job.internal_note_added",
    REVIEW_STARTED: "job.review_started",
  });
});
