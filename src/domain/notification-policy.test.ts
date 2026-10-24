import assert from "node:assert/strict";
import test from "node:test";

import {
  canReceiveManagementNotification,
  isSafeNotificationHref,
  notificationEventKey,
  notificationJobHref,
  notificationTypesForRole,
  NotificationPolicyError,
  parseNotificationListFilters,
} from "./notification-policy";

test("notification filters are normalized and bounded", () => {
  assert.deepEqual(parseNotificationListFilters({}), { filter: "ALL", page: 1 });
  assert.deepEqual(parseNotificationListFilters({ filter: "unread", page: "2" }), {
    filter: "UNREAD",
    page: 2,
  });
  for (const input of [
    { filter: "deleted" },
    { page: "0" },
    { page: "1.5" },
    { filter: ["all", "unread"] },
  ]) {
    assert.throws(() => parseNotificationListFilters(input), NotificationPolicyError);
  }
});

test("management notification recipients are restricted to OWNER and ADMIN", () => {
  assert.equal(canReceiveManagementNotification("OWNER"), true);
  assert.equal(canReceiveManagementNotification("ADMIN"), true);
  assert.equal(canReceiveManagementNotification("WORKER"), false);
  assert.equal(canReceiveManagementNotification("CUSTOMER"), false);
});

test("current roles expose only their permitted notification categories", () => {
  assert.deepEqual(notificationTypesForRole("CUSTOMER"), [
    "JOB_STATUS_UPDATED",
    "JOB_PROCESSING",
    "PREPARING_FOR_PICKUP",
    "READY_FOR_PICKUP",
    "PICKUP_VERIFIED",
    "QUOTATION_ISSUED",
    "QUOTATION_REVISED",
    "QUOTATION_WITHDRAWN",
    "QUOTATION_EXPIRED",
    "COUNTEROFFER_DECLINED",
  ]);
  assert.deepEqual(notificationTypesForRole("OWNER"), [
    "JOB_SUBMITTED",
    "COSTING_REQUIRED",
    "QUOTATION_ACCEPTED",
    "QUOTATION_DECLINED",
    "COUNTEROFFER_SUBMITTED",
    "PICKUP_VERIFIED",
  ]);
  assert.deepEqual(notificationTypesForRole("ADMIN"), notificationTypesForRole("OWNER"));
  assert.deepEqual(notificationTypesForRole("WORKER"), [
    "WORKER_ASSIGNED",
    "WORKER_CLAIMED",
    "JOB_PROCESSING",
    "PREPARING_FOR_PICKUP",
    "READY_FOR_PICKUP",
  ]);
});

test("notification destinations remain internal and role appropriate", () => {
  assert.equal(notificationJobHref("CUSTOMER", "JS-20261023-ABC234"), "/app/jobs/JS-20261023-ABC234");
  assert.equal(notificationJobHref("STAFF", "JS-20261023-ABC234"), "/app/staff/jobs/JS-20261023-ABC234");
  assert.equal(isSafeNotificationHref("/app/jobs/JS-1"), true);
  assert.equal(isSafeNotificationHref("https://example.com/app/jobs/JS-1"), false);
  assert.equal(isSafeNotificationHref("//example.com/app"), false);
  assert.throws(() => notificationJobHref("CUSTOMER", "../private"), NotificationPolicyError);
});

test("event keys are stable and reject ambiguous values", () => {
  assert.equal(
    notificationEventKey("quotation", "90a6296a-a321-4eb5-9aae-27f10fa7b907", "issued"),
    "quotation:90a6296a-a321-4eb5-9aae-27f10fa7b907:issued",
  );
  assert.throws(
    () => notificationEventKey("job", "unsafe/value", "submitted"),
    NotificationPolicyError,
  );
});
