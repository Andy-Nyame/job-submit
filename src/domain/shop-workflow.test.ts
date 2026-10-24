import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  action: new URL("../app/app/services/actions.ts", import.meta.url),
  customerPage: new URL("../app/app/jobs/new/page.tsx", import.meta.url),
  customerQuery: new URL("../server/jobs/queries.ts", import.meta.url),
  management: new URL("../server/shop/management.ts", import.meta.url),
  migration: new URL("../../prisma/migrations/20261024120000_business_job_intake/migration.sql", import.meta.url),
  schema: new URL("../../prisma/schema.prisma", import.meta.url),
  submission: new URL("../server/jobs/job-submission.ts", import.meta.url),
};

test("shop intake persistence is additive and preserves the operating default", async () => {
  const [schema, migration] = await Promise.all([
    readFile(files.schema, "utf8"),
    readFile(files.migration, "utf8"),
  ]);
  assert.match(schema, /acceptingNewJobs\s+Boolean\s+@default\(true\)/u);
  assert.match(migration, /ADD COLUMN "acceptingNewJobs" BOOLEAN NOT NULL DEFAULT true/u);
  assert.doesNotMatch(migration, /DROP|DELETE|UPDATE "Service"/u);
});

test("shop changes are management-only, scoped, concurrency-safe, and audited", async () => {
  const [management, action] = await Promise.all([
    readFile(files.management, "utf8"),
    readFile(files.action, "utf8"),
  ]);
  assert.match(management, /assertCanManageShop\(actor\.role\)/u);
  assert.match(management, /role: \{ in: \["OWNER", "ADMIN"\] \}/u);
  assert.match(management, /businessId: actor\.businessId/u);
  assert.match(management, /acceptingNewJobs: input\.expectedState/u);
  assert.match(management, /TransactionIsolationLevel\.Serializable/u);
  assert.match(management, /auditLog\.create/u);
  assert.match(management, /targetType: "Business"/u);
  assert.match(action, /requireServiceManager\(\)/u);
});

test("customer availability distinguishes shop closure from disabled services", async () => {
  const [query, page] = await Promise.all([
    readFile(files.customerQuery, "utf8"),
    readFile(files.customerPage, "utf8"),
  ]);
  assert.match(query, /acceptingNewJobs: true/u);
  assert.match(query, /onlineSubmissionEnabled: true/u);
  assert.match(page, /We&apos;re not taking new jobs right now/u);
  assert.match(page, /No services are ready for online requests/u);
});

test("final job creation rechecks shop state in the serializable write transaction", async () => {
  const submission = await readFile(files.submission, "utf8");
  assert.match(submission, /ensureActiveCustomer\(transaction, actor\)/u);
  assert.match(submission, /membership\.business\.acceptingNewJobs/u);
  assert.match(submission, /new JobOperationError\("SHOP_CLOSED"\)/u);
  assert.match(submission, /TransactionIsolationLevel\.Serializable/u);
  assert.match(submission, /submissionKey/u);
});
