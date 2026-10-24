import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  dependency: new URL("../server/job-operations/management.ts", import.meta.url),
  migration: new URL("../../prisma/migrations/20261024220000_service_pricing_recovery/migration.sql", import.meta.url),
  serviceRoute: new URL("../app/api/management/services/[serviceId]/route.ts", import.meta.url),
  shopRoute: new URL("../app/api/management/shop/route.ts", import.meta.url),
  submission: new URL("../server/jobs/job-submission.ts", import.meta.url),
};

test("critical shop and service saves use authenticated recoverable route handlers", async () => {
  const [shop, service] = await Promise.all([readFile(files.shopRoute, "utf8"), readFile(files.serviceRoute, "utf8")]);
  assert.match(shop, /requireServiceManager\(\)/u);
  assert.match(shop, /isSameOriginMutation/u);
  assert.match(shop, /setShopOpenState/u);
  assert.match(shop, /STALE_UPDATE/u);
  assert.match(service, /requireServiceManager\(\)/u);
  assert.match(service, /isSameOriginMutation/u);
  assert.match(service, /updateServiceFromProfile/u);
  assert.match(service, /field:/u);
});

test("management JSON mutations require a browser same-origin signal", async () => {
  const helper = await readFile(new URL("../server/http/same-origin.ts", import.meta.url), "utf8");
  assert.match(helper, /headers\.get\("origin"\)/u);
  assert.match(helper, /x-forwarded-host/u);
  assert.match(helper, /originUrl\.host === host/u);
});

test("pricing migration is additive, version-compatible, and never enables services", async () => {
  const migration = await readFile(files.migration, "utf8");
  assert.match(migration, /version' IN \('1', '2'\)/u);
  assert.match(migration, /ADD COLUMN "submissionGroupReference"/u);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|UPDATE "Service"|onlineSubmissionEnabled/u);
});

test("linked design and print jobs are atomic, idempotent, and production-gated", async () => {
  const [submission, dependency] = await Promise.all([readFile(files.submission, "utf8"), readFile(files.dependency, "utf8")]);
  assert.match(submission, /linkedSubmissionKey/u);
  assert.match(submission, /submissionGroupReference/u);
  assert.match(submission, /dependsOnJobId/u);
  assert.match(submission, /TransactionIsolationLevel\.Serializable/u);
  assert.match(dependency, /job\.design_dependency_cleared/u);
  assert.match(dependency, /job\.dependsOnJobId && !job\.dependencyClearedAt/u);
});
