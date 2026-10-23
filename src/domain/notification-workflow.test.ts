import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  actions: new URL("../app/app/notifications/actions.ts", import.meta.url),
  bell: new URL("../components/notifications/notification-bell.tsx", import.meta.url),
  customerQuotation: new URL("../server/quotations/customer.ts", import.meta.url),
  events: new URL("../server/notifications/events.ts", import.meta.url),
  jobSubmission: new URL("../server/jobs/job-submission.ts", import.meta.url),
  management: new URL("../server/notifications/management.ts", import.meta.url),
  migration: new URL("../../prisma/migrations/20261023220000_notifications_action_center/migration.sql", import.meta.url),
  queries: new URL("../server/notifications/queries.ts", import.meta.url),
  quotationManagement: new URL("../server/quotations/management.ts", import.meta.url),
  schema: new URL("../../prisma/schema.prisma", import.meta.url),
  staffManagement: new URL("../server/staff-jobs/management.ts", import.meta.url),
};

test("notification persistence is recipient scoped, indexed, and retry deduplicated", async () => {
  const [schema, migration] = await Promise.all([
    readFile(files.schema, "utf8"),
    readFile(files.migration, "utf8"),
  ]);
  assert.match(schema, /model Notification \{/u);
  assert.match(schema, /eventKey\s+String\?/u);
  assert.match(schema, /@@unique\(\[businessId, recipientUserId, eventKey\]\)/u);
  assert.match(schema, /@@index\(\[businessId, recipientUserId, readAt, createdAt\]\)/u);
  assert.match(migration, /Notification_businessId_recipientUserId_eventKey_key/u);
});

test("event recipients come only from active authoritative memberships", async () => {
  const source = await readFile(files.events, "utf8");
  assert.match(source, /business: \{ archivedAt: null, isActive: true \}/u);
  assert.match(source, /deactivatedAt: null/u);
  assert.match(source, /status: "ACTIVE"/u);
  assert.match(source, /user: \{/u);
  assert.match(source, /\[\s*"OWNER",\s*"ADMIN",?\s*\]/u);
  assert.match(source, /\["CUSTOMER"\]/u);
  assert.doesNotMatch(source, /"WORKER"\][\s\S]*notifyManagement/u);
});

test("notification creation is durable and duplicate-safe inside domain transactions", async () => {
  const [events, submission, staff, quote, customer] = await Promise.all([
    readFile(files.events, "utf8"),
    readFile(files.jobSubmission, "utf8"),
    readFile(files.staffManagement, "utf8"),
    readFile(files.quotationManagement, "utf8"),
    readFile(files.customerQuotation, "utf8"),
  ]);
  assert.match(events, /notification\.createMany/u);
  assert.match(events, /skipDuplicates: true/u);
  assert.match(submission, /notifyManagementOfNewJob\(transaction/u);
  assert.match(staff, /notifyCustomerOfJobStatus\(transaction/u);
  assert.match(quote, /notifyCustomerOfQuotationIssued\(transaction/u);
  assert.match(quote, /notifyCustomerOfQuotationOutcome\(transaction/u);
  assert.match(customer, /notifyManagementOfQuotationDecision\(transaction/u);
  assert.match(customer, /notifyManagementOfCounteroffer\(transaction/u);
});

test("counteroffer safeguards remain negotiation-gated and never imply approval", async () => {
  const [events, customer] = await Promise.all([
    readFile(files.events, "utf8"),
    readFile(files.customerQuotation, "utf8"),
  ]);
  assert.match(customer, /if \(!quotation\.negotiationAllowed\)/u);
  assert.match(customer, /COUNTEROFFER_NOT_ALLOWED/u);
  assert.match(events, /It has not been accepted automatically/u);
  assert.doesNotMatch(events, /customerNote|profit|margin/u);
});

test("notification reads and mutations enforce user and business ownership", async () => {
  const [queries, management, actions] = await Promise.all([
    readFile(files.queries, "utf8"),
    readFile(files.management, "utf8"),
    readFile(files.actions, "utf8"),
  ]);
  assert.match(queries, /recipientUserId: principal\.userId/u);
  assert.match(queries, /businessId: principal\.businessId/u);
  assert.match(queries, /notificationTypesForRole\(principal\.role\)/u);
  assert.match(management, /recipientUserId: actor\.userId/u);
  assert.match(management, /businessId: actor\.businessId/u);
  assert.match(management, /notificationTypesForRole\(actor\.role\)/u);
  assert.match(management, /ensureCurrentMembership/u);
  assert.match(actions, /requireBusinessMembership\(\)/u);
  assert.doesNotMatch(management, /notification\.(delete|deleteMany)/u);
});

test("notification queries are bounded, paginated, and use a focused unread count", async () => {
  const source = await readFile(files.queries, "utf8");
  assert.match(source, /take: NOTIFICATION_RECENT_LIMIT/u);
  assert.match(source, /skip: \(page - 1\) \* NOTIFICATION_PAGE_SIZE/u);
  assert.match(source, /take: NOTIFICATION_PAGE_SIZE/u);
  assert.match(source, /readAt: null/u);
  assert.match(source, /createdAt: "desc"/u);
});

test("notification bell exposes accessible unread and panel state", async () => {
  const source = await readFile(files.bell, "utf8");
  assert.match(source, /aria-expanded=\{open\}/u);
  assert.match(source, /aria-label=/u);
  assert.match(source, /event\.key === "Escape"/u);
  assert.match(source, /View all/u);
  assert.match(source, /No notifications yet/u);
  assert.match(source, /openNotificationAction/u);
});
