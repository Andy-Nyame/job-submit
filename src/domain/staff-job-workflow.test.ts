import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  action: new URL("../app/app/staff/jobs/actions.ts", import.meta.url),
  attachment: new URL("../app/api/jobs/[publicReference]/attachments/[attachmentId]/route.ts", import.meta.url),
  customerQuery: new URL("../server/jobs/queries.ts", import.meta.url),
  detail: new URL("../app/app/staff/jobs/[publicReference]/page.tsx", import.meta.url),
  inbox: new URL("../server/staff-jobs/queries.ts", import.meta.url),
  management: new URL("../server/staff-jobs/management.ts", import.meta.url),
};

test("staff inbox and detail reads are business-scoped, filtered, and paginated server-side", async () => {
  const source = await readFile(files.inbox, "utf8");
  assert.match(source, /requireStaffJobAccess\(\)/u);
  assert.match(source, /businessId: principal\.businessId/u);
  assert.match(source, /publicReference:/u);
  assert.match(source, /customer:/u);
  assert.match(source, /currentStatus: filters\.status/u);
  assert.match(source, /serviceId: filters\.serviceId/u);
  assert.match(source, /priority: filters\.priority/u);
  assert.match(source, /skip: \(page - 1\) \* STAFF_JOB_PAGE_SIZE/u);
  assert.match(source, /take: STAFF_JOB_PAGE_SIZE/u);
  assert.match(source, /orderBy: inboxOrderBy\(filters\)/u);
});

test("staff detail uses the saved submission snapshot and keeps internal data on the staff route", async () => {
  const [query, detail] = await Promise.all([
    readFile(files.inbox, "utf8"),
    readFile(files.detail, "utf8"),
  ]);
  assert.match(query, /submissionSnapshot: true/u);
  assert.match(query, /statusHistory:/u);
  assert.match(query, /notes:/u);
  assert.match(query, /attachments:/u);
  assert.match(detail, /isJobSubmissionSnapshot/u);
  assert.match(detail, /Quotation pending/u);
  assert.match(detail, /Authoritative calculation saved at submission/u);
  assert.match(detail, /Internal staff notes/u);
  assert.match(detail, /Batch|Service information/u);
});

test("review transition is authorized, compare-and-set, append-only, and audited atomically", async () => {
  const [action, management] = await Promise.all([
    readFile(files.action, "utf8"),
    readFile(files.management, "utf8"),
  ]);
  assert.match(action, /requireStaffJobAccess\(\)/u);
  assert.match(management, /assertCanManageStaffJobs\(actor\.role\)/u);
  assert.match(management, /TransactionIsolationLevel\.Serializable/u);
  assert.match(management, /currentStatus: "SUBMITTED"/u);
  assert.match(management, /version: input\.expectedVersion/u);
  assert.match(management, /version: \{ increment: 1 \}/u);
  assert.match(management, /jobStatusHistory\.create/u);
  assert.match(management, /fromStatus: "SUBMITTED"/u);
  assert.match(management, /toStatus: "UNDER_REVIEW"/u);
  assert.match(management, /STAFF_JOB_AUDIT_ACTIONS\.REVIEW_STARTED/u);
});

test("internal notes validate input, preserve authorship, and audit without storing note text in audit metadata", async () => {
  const management = await readFile(files.management, "utf8");
  assert.match(management, /normalizeInternalNote\(input\.body\)/u);
  assert.match(management, /jobNote\.create/u);
  assert.match(management, /authorMembershipId: actor\.membershipId/u);
  assert.match(management, /STAFF_JOB_AUDIT_ACTIONS\.NOTE_ADDED/u);
  assert.match(management, /metadata: \{ noteId: note\.id \}/u);
  assert.doesNotMatch(management, /jobNote\.(update|delete)/u);
});

test("customer queries expose status updates but never staff notes", async () => {
  const source = await readFile(files.customerQuery, "utf8");
  assert.match(source, /customer: \{ userId: principal\.userId \}/u);
  assert.match(source, /statusHistory:/u);
  assert.doesNotMatch(source, /notes:/u);
  assert.doesNotMatch(source, /reason: true/u);
  assert.doesNotMatch(source, /actorUser:/u);
});

test("private attachment delivery supports only owning customers or active staff in the same business", async () => {
  const source = await readFile(files.attachment, "utf8");
  assert.match(source, /requireBusinessMembership\(\)/u);
  assert.match(source, /canManageStaffJobs\(actor\.role\)/u);
  assert.match(source, /businessId: actor\.businessId/u);
  assert.match(source, /customer: \{ userId: actor\.userId \}/u);
  assert.match(source, /access: "private"/u);
  assert.match(source, /Cache-Control": "private, no-store"/u);
  assert.match(source, /X-Content-Type-Options/u);
});
