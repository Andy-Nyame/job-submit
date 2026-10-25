import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  action: new URL("../app/app/jobs/actions.ts", import.meta.url),
  component: new URL("../components/jobs/customer-job-submission-form.tsx", import.meta.url),
  detail: new URL("../app/app/jobs/[publicReference]/page.tsx", import.meta.url),
  download: new URL("../app/api/jobs/[publicReference]/attachments/[attachmentId]/route.ts", import.meta.url),
  server: new URL("../server/jobs/job-submission.ts", import.meta.url),
  upload: new URL("../app/api/customer-uploads/route.ts", import.meta.url),
};

const serverActionModules = [
  new URL("../app/(auth)/actions.ts", import.meta.url),
  new URL("../app/invite/actions.ts", import.meta.url),
  new URL("../app/app/jobs/actions.ts", import.meta.url),
  new URL("../app/app/jobs/quotation-actions.ts", import.meta.url),
  new URL("../app/app/notifications/actions.ts", import.meta.url),
  new URL("../app/app/services/actions.ts", import.meta.url),
  new URL("../app/app/staff/jobs/actions.ts", import.meta.url),
  new URL("../app/app/staff/jobs/quotation-actions.ts", import.meta.url),
  new URL("../app/app/staff/pickup/actions.ts", import.meta.url),
  new URL("../app/app/team/actions.ts", import.meta.url),
];

test("submission UI includes conditional review, upload, pending, and accessible error states", async () => {
  const source = await readFile(files.component, "utf8");
  assert.match(source, /Step 1 of 3/u);
  assert.match(source, /Step 2 of 3/u);
  assert.match(source, /Step 3 of 3/u);
  assert.match(source, /Choose what you need/u);
  assert.match(source, /Tell us the details/u);
  assert.match(source, /Check and Submit/u);
  assert.match(source, /Submit My Job/u);
  assert.match(source, /Preparing secure review/u);
  assert.match(source, /role="alert"/u);
  assert.match(source, /Technical proof is not required/u);
  assert.match(source, /onUploadProgress/u);
  assert.match(source, /send you a price/u);
  assert.match(source, /No GH₵0 price/u);
});

test("server submission reauthorizes customers and creates one atomic operational record", async () => {
  const [action, server] = await Promise.all([
    readFile(files.action, "utf8"),
    readFile(files.server, "utf8"),
  ]);
  assert.match(action, /requireCustomer\(\)/u);
  assert.match(server, /TransactionIsolationLevel\.Serializable/u);
  assert.match(server, /source: "CUSTOMER_PORTAL"/u);
  assert.match(server, /toStatus: "SUBMITTED"/u);
  assert.match(server, /submissionKey/u);
  assert.match(server, /job\.customer_submitted/u);
  assert.match(server, /status: \{ in: \["PENDING", "UPLOADED"\] \}/u);
});

test('"use server" modules export async actions only', async () => {
  for (const moduleUrl of serverActionModules) {
    const source = await readFile(moduleUrl, "utf8");
    assert.match(source, /^"use server";/u, moduleUrl.pathname);
    assert.doesNotMatch(
      source,
      /^export\s+(?:class|const|function|let|var)\s/mu,
      `${moduleUrl.pathname} must not expose a synchronous runtime value`,
    );
    assert.doesNotMatch(
      source,
      /^export\s*\{/mu,
      `${moduleUrl.pathname} must not re-export runtime values`,
    );
  }
});

test("private upload and download routes enforce identity, ownership, and nosniff delivery", async () => {
  const [upload, download] = await Promise.all([
    readFile(files.upload, "utf8"),
    readFile(files.download, "utf8"),
  ]);
  assert.match(upload, /requireCustomer\(\)/u);
  assert.match(upload, /allowedContentTypes/u);
  assert.match(upload, /maximumSizeInBytes/u);
  assert.match(download, /requireBusinessMembership\(\)/u);
  assert.match(download, /canManageStaffJobs\(actor\.role\)/u);
  assert.match(download, /customer: \{ userId: actor\.userId \}/u);
  assert.match(download, /businessId: actor\.businessId/u);
  assert.match(download, /access: "private"/u);
  assert.match(download, /X-Content-Type-Options/u);
  assert.doesNotMatch(download, /publicReference\s*\)\s*\{/u);
});

test("customer details route does not expose staff notes or other customer data", async () => {
  const detail = await readFile(files.detail, "utf8");
  assert.doesNotMatch(detail, /jobNotes|notes:/u);
  assert.doesNotMatch(detail, /customer\.email|customer\.phone/u);
  assert.match(detail, /send you a price soon/u);
  assert.match(detail, /Job updates/u);
});
