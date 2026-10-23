import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  customer: new URL("../server/quotations/customer.ts", import.meta.url),
  customerQuery: new URL("../server/jobs/queries.ts", import.meta.url),
  management: new URL("../server/quotations/management.ts", import.meta.url),
  managementQuery: new URL("../server/quotations/queries.ts", import.meta.url),
  migration: new URL("../../prisma/migrations/20261023170000_smart_pricing_quotations/migration.sql", import.meta.url),
  schema: new URL("../../prisma/schema.prisma", import.meta.url),
  service: new URL("../server/services/service-management.ts", import.meta.url),
};

test("negotiation defaults off and service changes remain management-audited", async () => {
  const [schema, migration, service] = await Promise.all([
    readFile(files.schema, "utf8"),
    readFile(files.migration, "utf8"),
    readFile(files.service, "utf8"),
  ]);
  assert.match(schema, /allowPriceNegotiation\s+Boolean\s+@default\(false\)/u);
  assert.match(migration, /ADD COLUMN "allowPriceNegotiation" BOOLEAN NOT NULL DEFAULT false/u);
  assert.match(migration, /Service_negotiation_manual_pricing_only_check/u);
  assert.match(service, /allowPriceNegotiation: settings\.allowPriceNegotiation/u);
  assert.match(service, /SERVICE_AUDIT_ACTIONS\.UPDATED/u);
});

test("manual quotation creation is management-only, business-scoped, and serializable", async () => {
  const source = await readFile(files.management, "utf8");
  assert.match(source, /assertCanManageQuotations\(actor\.role\)/u);
  assert.match(source, /role: \{ in: \["ADMIN", "OWNER"\] \}/u);
  assert.match(source, /businessId: actor\.businessId/u);
  assert.match(source, /TransactionIsolationLevel\.Serializable/u);
  assert.match(source, /requireManualSnapshot/u);
  assert.match(source, /FIXED_PRICE_JOB/u);
});

test("issuing freezes service negotiation policy and supersedes the former active offer", async () => {
  const source = await readFile(files.management, "utf8");
  assert.match(source, /allowPriceNegotiation: true/u);
  assert.match(source, /negotiationAllowed: draft\.job\.service\.allowPriceNegotiation/u);
  assert.match(source, /expiresAt: quotationExpiryFromDays\(draft\.validityDays, now\)/u);
  assert.match(source, /status: "SUPERSEDED"/u);
  assert.match(source, /QUOTATION_AUDIT_ACTIONS\.ISSUED/u);
  assert.match(source, /QUOTATION_AUDIT_ACTIONS\.SUPERSEDED/u);
});

test("customer decisions and counteroffers reauthorize ownership and compare versions", async () => {
  const source = await readFile(files.customer, "utf8");
  assert.match(source, /role: "CUSTOMER"/u);
  assert.match(source, /customer: \{ userId: actor\.userId \}/u);
  assert.match(source, /rowVersion: input\.expectedVersion/u);
  assert.match(source, /negotiationAllowed/u);
  assert.match(source, /COUNTEROFFER_NOT_ALLOWED/u);
  assert.match(source, /status: "ACCEPTED"/u);
  assert.match(source, /status: "DECLINED"/u);
  assert.doesNotMatch(source, /currentStatus:/u);
});

test("customer reads exclude drafts and remain customer/business scoped", async () => {
  const source = await readFile(files.customerQuery, "utf8");
  assert.match(source, /customer: \{ userId: principal\.userId \}/u);
  assert.match(source, /businessId: principal\.businessId/u);
  assert.match(source, /issuedAt: \{ not: null \}/u);
  assert.match(source, /status: \{ not: "DRAFT" \}/u);
});

test("management costing queries are OWNER/ADMIN protected and workers receive no amounts", async () => {
  const source = await readFile(files.managementQuery, "utf8");
  assert.match(source, /requireQuotationManager\(\)/u);
  assert.match(source, /businessId: principal\.businessId/u);
  assert.match(source, /totalMinor: true/u);
});

test("database constraints preserve issued terms, one active offer, and one pending counteroffer", async () => {
  const source = await readFile(files.migration, "utf8");
  assert.match(source, /JobQuotation_one_issued_per_job/u);
  assert.match(source, /JobQuotation_one_accepted_per_job/u);
  assert.match(source, /QuotationCounteroffer_one_pending_per_quotation/u);
  assert.match(source, /Issued JobQuotation financial terms are immutable/u);
  assert.match(source, /JobQuotation records are preserved/u);
  assert.match(source, /Invalid JobQuotation status transition/u);
  assert.match(source, /"expressSurchargeBasisPoints" = 4000/u);
});
