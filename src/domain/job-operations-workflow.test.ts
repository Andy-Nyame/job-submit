import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  actions: new URL("../app/app/staff/jobs/actions.ts", import.meta.url),
  customer: new URL("../app/app/jobs/[publicReference]/page.tsx", import.meta.url),
  label: new URL("../app/app/staff/jobs/[publicReference]/label/page.tsx", import.meta.url),
  management: new URL("../server/job-operations/management.ts", import.meta.url),
  migration: new URL("../../prisma/migrations/20261024203000_job_operations_pickup/migration.sql", import.meta.url),
  pickup: new URL("../components/staff-jobs/pickup-verification-panel.tsx", import.meta.url),
  refresh: new URL("../components/layout/foreground-refresh.tsx", import.meta.url),
  schema: new URL("../../prisma/schema.prisma", import.meta.url),
  sound: new URL("../components/notifications/notification-sound.tsx", import.meta.url),
};

test("operational release enforces confirmed pricing and management authority", async () => {
  const source = await readFile(files.management, "utf8");
  assert.match(source, /assertCanManageOperations\(actor\.role\)/u);
  assert.match(source, /hasConfirmedOperationalPrice/u);
  assert.match(source, /status: "ACCEPTED"/u);
  assert.match(source, /TransactionIsolationLevel\.Serializable/u);
  assert.match(source, /queueEnteredAt: now/u);
  assert.match(source, /jobStatusHistory\.create/u);
  assert.match(source, /PRODUCTION_RELEASED/u);
});

test("exclusive claims preserve assignment history and enforce skill and workload capacity", async () => {
  const [source, migration] = await Promise.all([readFile(files.management, "utf8"), readFile(files.migration, "utf8")]);
  assert.match(source, /assertWorkerEligible/u);
  assert.match(source, /canAcceptConfiguredWorkload/u);
  assert.match(source, /skills: \{/u);
  assert.match(source, /jobAssignment\.create/u);
  assert.match(source, /ASSIGNMENT_CONFLICT/u);
  assert.match(migration, /queueOrderTier/u);
});

test("physical labels use the canonical reference, package count, and authenticated staff destination", async () => {
  const source = await readFile(files.label, "utf8");
  assert.match(source, /job\.publicReference/u);
  assert.match(source, /job\.packageCount/u);
  assert.match(source, /staffJobUrl/u);
  assert.match(source, /qrDataUrl/u);
  assert.doesNotMatch(source, /customer.*email|customer.*phone/iu);
});

test("pickup credentials are encrypted, hashed, one-time, and explicitly confirmed", async () => {
  const [schema, migration, management, pickup, customer] = await Promise.all([
    readFile(files.schema, "utf8"), readFile(files.migration, "utf8"), readFile(files.management, "utf8"), readFile(files.pickup, "utf8"), readFile(files.customer, "utf8"),
  ]);
  assert.match(schema, /codeHash\s+String/u);
  assert.match(schema, /codeCiphertext\s+String/u);
  assert.match(migration, /PickupVerification_credential_check/u);
  assert.match(management, /encryptPickupCode/u);
  assert.match(management, /hashPickupCode/u);
  assert.match(management, /status: "CONSUMED"/u);
  assert.match(management, /currentStatus: "PICKED_UP"/u);
  assert.match(management, /pickupChecklistComplete/u);
  assert.match(pickup, /Confirm Pickup/u);
  assert.match(customer, /Private pickup QR code/iu);
  assert.doesNotMatch(management, /starLedger\.(create|update)/u);
});

test("automatic refresh is coordinated, foreground-only, and reconnect aware", async () => {
  const source = await readFile(files.refresh, "utf8");
  assert.match(source, /20_000/u);
  assert.match(source, /router\.refresh\(\)/u);
  assert.match(source, /visibilitychange/u);
  assert.match(source, /window\.addEventListener\("online"/u);
  assert.match(source, /window\.clearInterval/u);
  assert.doesNotMatch(source, /window\.location\.reload/u);
});

test("sound and voice stay opt-in, role-safe, deduplicated, and visible-tab only", async () => {
  const source = await readFile(files.sound, "utf8");
  assert.match(source, /mode: "SILENT"/u);
  assert.match(source, /SpeechSynthesisUtterance/u);
  assert.match(source, /seenIds/u);
  assert.match(source, /document\.visibilityState !== "visible"/u);
  assert.match(source, /Sound \+ Voice/u);
  assert.match(source, /Test Alert/u);
  assert.doesNotMatch(source, /customer.*name|phone|profit|margin/iu);
});
