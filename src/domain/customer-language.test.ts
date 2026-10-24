import assert from "node:assert/strict";
import test from "node:test";

import { customerJobStatusLabel } from "./customer-language";

test("customer job statuses use clear everyday language", () => {
  assert.equal(customerJobStatusLabel("SUBMITTED"), "We received your job");
  assert.equal(customerJobStatusLabel("UNDER_REVIEW"), "We're checking your job");
  assert.equal(customerJobStatusLabel("READY_FOR_PICKUP"), "Ready for pickup");
  assert.equal(customerJobStatusLabel("UNKNOWN"), "Status updated");
});
