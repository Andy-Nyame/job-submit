import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanManageServices,
  canApplyServiceVersion,
  canManageServices,
  isServicePubliclyEligible,
  MAX_SERVICE_DESCRIPTION_LENGTH,
  MAX_SERVICE_SORT_ORDER,
  normalizeServiceDescription,
  normalizeServiceName,
  SERVICE_AUDIT_ACTIONS,
  SERVICE_EDITABLE_FIELDS,
  serviceLifecycleAuditAction,
  ServicePolicyError,
  serviceSlugFromName,
  validateServiceSettings,
} from "./service-policy";

const validSettings = {
  defaultComplexity: null,
  defaultWorkloadClass: null,
  description: "  Public   summary  ",
  isActive: true,
  name: "  Document   Printing  ",
  onlineSubmissionEnabled: false,
  proofRequiredByDefault: null,
  sortOrder: 40,
} as const;

test("only OWNER and ADMIN can manage services", () => {
  assert.equal(canManageServices("OWNER"), true);
  assert.equal(canManageServices("ADMIN"), true);
  assert.equal(canManageServices("WORKER"), false);
  assert.equal(canManageServices("CUSTOMER"), false);
  assert.equal(canManageServices(null), false);
  assert.throws(() => assertCanManageServices("WORKER"), ServicePolicyError);
  assert.throws(() => assertCanManageServices("CUSTOMER"), ServicePolicyError);
});

test("service input is normalized without requiring a price", () => {
  const service = validateServiceSettings(validSettings);
  assert.equal(service.name, "Document Printing");
  assert.equal(service.slug, "document-printing");
  assert.equal(service.description, "Public summary");
  assert.equal("price" in service, false);
});

test("the management contract contains no pricing fields", () => {
  const pricingPattern = /(price|amount|rate)/i;
  assert.equal(
    SERVICE_EDITABLE_FIELDS.some((field) => pricingPattern.test(field)),
    false,
  );
});

test("empty and excessive service names are rejected", () => {
  assert.throws(() => normalizeServiceName("   "), ServicePolicyError);
  assert.throws(
    () => normalizeServiceName("x".repeat(161)),
    ServicePolicyError,
  );
});

test("excessive service descriptions are rejected", () => {
  assert.equal(normalizeServiceDescription("   "), null);
  assert.throws(
    () => normalizeServiceDescription("x".repeat(MAX_SERVICE_DESCRIPTION_LENGTH + 1)),
    ServicePolicyError,
  );
});

test("normalized slugs make conflicting names deterministic", () => {
  assert.equal(
    serviceSlugFromName("SAV / Sticker Printing"),
    serviceSlugFromName(" sav---sticker   printing "),
  );
});

test("invalid configuration and display order are rejected", () => {
  assert.throws(
    () => validateServiceSettings({ ...validSettings, sortOrder: -1 }),
    ServicePolicyError,
  );
  assert.throws(
    () =>
      validateServiceSettings({
        ...validSettings,
        sortOrder: MAX_SERVICE_SORT_ORDER + 1,
      }),
    ServicePolicyError,
  );
  assert.throws(
    () =>
      validateServiceSettings({
        ...validSettings,
        defaultComplexity: "INVALID" as "SIMPLE",
      }),
    ServicePolicyError,
  );
});

test("optimistic versions reject stale concurrent edits", () => {
  assert.equal(canApplyServiceVersion(3, 3), true);
  assert.equal(canApplyServiceVersion(4, 3), false);
});

test("public catalogue eligibility follows non-destructive lifecycle state", () => {
  assert.equal(
    isServicePubliclyEligible({ archivedAt: null, isActive: true }),
    true,
  );
  assert.equal(
    isServicePubliclyEligible({ archivedAt: null, isActive: false }),
    false,
  );
  assert.equal(
    isServicePubliclyEligible({ archivedAt: new Date(), isActive: true }),
    false,
  );
});

test("deactivation and restoration use distinct audit events", () => {
  assert.deepEqual(SERVICE_AUDIT_ACTIONS, {
    CREATED: "service.created",
    DEACTIVATED: "service.deactivated",
    RESTORED: "service.restored",
    UPDATED: "service.updated",
  });
  assert.equal(
    serviceLifecycleAuditAction(false),
    SERVICE_AUDIT_ACTIONS.DEACTIVATED,
  );
  assert.equal(
    serviceLifecycleAuditAction(true),
    SERVICE_AUDIT_ACTIONS.RESTORED,
  );
});

test("the six seeded services normalize to distinct stable keys", () => {
  const names = [
    "Designing",
    "SAV / Sticker Printing",
    "Flexi / Banner Printing",
    "Document Printing",
    "For Sale Sticker Printing",
    "Container Head Sticker / Batch Numbers Printing",
  ];
  const slugs = names.map(serviceSlugFromName);
  assert.equal(new Set(slugs).size, 6);
  assert.deepEqual(slugs, [
    "designing",
    "sav-sticker-printing",
    "flexi-banner-printing",
    "document-printing",
    "for-sale-sticker-printing",
    "container-head-sticker-batch-numbers-printing",
  ]);
});

test("service defaults remain optional per-job guidance", () => {
  const service = validateServiceSettings({
    ...validSettings,
    defaultComplexity: "COMPLEX",
    defaultWorkloadClass: "FOCUS",
    proofRequiredByDefault: true,
  });
  assert.equal(service.defaultComplexity, "COMPLEX");
  assert.equal(service.defaultWorkloadClass, "FOCUS");
  assert.equal(service.proofRequiredByDefault, true);
});
