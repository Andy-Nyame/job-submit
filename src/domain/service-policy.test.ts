import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanManageServices,
  canApplyServiceVersion,
  canManageServices,
  isServicePubliclyEligible,
  MAX_SERVICE_DESCRIPTION_LENGTH,
  nextServiceSortOrder,
  normalizeServiceDescription,
  normalizeServiceName,
  SERVICE_AUDIT_ACTIONS,
  SERVICE_EDITABLE_FIELDS,
  serviceDifficultyDefaults,
  serviceLifecycleAuditAction,
  ServicePolicyError,
  serviceSlugFromName,
  type ServiceSettingsInput,
  validateServiceSettings,
} from "./service-policy";
import {
  SEEDED_SERVICES,
  shouldReconcileSeededServiceName,
} from "./service-seed";

const validSettings: ServiceSettingsInput = {
  allowPriceNegotiation: false,
  defaultComplexity: null,
  description: "  Public   summary  ",
  isActive: true,
  name: "  Document   Printing  ",
  onlineSubmissionEnabled: false,
  pricing: {
    additionalStepPrice: "",
    coverage: "",
    mode: "ON_REQUEST",
    startingPrice: "",
    startingQuantity: "",
  },
  quantity: {
    increment: "",
    maximum: "",
    minimum: "",
    presets: "",
    unit: "",
  },
  specification: {
    artworkRequirement: "",
    customDimensionUnits: [],
    customFields: [],
    customInstructions: "",
    finishingOptions: "",
    finishingRequired: false,
    fixedSizeHeight: "",
    fixedSizeUnit: "",
    fixedSizeWidth: "",
    materialOptions: "",
    materialsRequired: false,
    sizeMode: "NO_SIZE",
    standardSizeOptions: "",
    variationsEnabled: false,
  },
};

test("only OWNER and ADMIN can manage services", () => {
  assert.equal(canManageServices("OWNER"), true);
  assert.equal(canManageServices("ADMIN"), true);
  assert.equal(canManageServices("WORKER"), false);
  assert.equal(canManageServices("CUSTOMER"), false);
  assert.equal(canManageServices(null), false);
  assert.throws(() => assertCanManageServices("WORKER"), ServicePolicyError);
  assert.throws(() => assertCanManageServices("CUSTOMER"), ServicePolicyError);
});

test("service input is normalized while advanced settings remain optional", () => {
  const service = validateServiceSettings(validSettings);
  assert.equal(service.name, "Document Printing");
  assert.equal(service.slug, "document-printing");
  assert.equal(service.description, "Public summary");
  assert.equal(service.quantityConfiguration, null);
  assert.equal(service.specificationConfiguration, null);
  assert.equal(service.pricingConfiguration.mode, "ON_REQUEST");
  assert.equal(service.allowPriceNegotiation, false);
});

test("negotiation is opt-in for manual pricing and cannot attach to fixed pricing", () => {
  assert.equal(
    validateServiceSettings({ ...validSettings, allowPriceNegotiation: true })
      .allowPriceNegotiation,
    true,
  );
  const fixed = validateServiceSettings({
    ...validSettings,
    allowPriceNegotiation: true,
    pricing: {
      additionalStepPrice: "2.00",
      coverage: "Configured work",
      mode: "FIXED",
      startingPrice: "10.00",
      startingQuantity: "5",
    },
    quantity: {
      increment: "5",
      maximum: "",
      minimum: "5",
      presets: "5, 10",
      unit: "pieces",
    },
  });
  assert.equal(fixed.allowPriceNegotiation, false);
});

test("display order is not part of the manager-editable contract", () => {
  assert.equal(SERVICE_EDITABLE_FIELDS.includes("sortOrder" as never), false);
  assert.equal(SERVICE_EDITABLE_FIELDS.includes("quantityConfiguration"), true);
  assert.equal(SERVICE_EDITABLE_FIELDS.includes("pricingConfiguration"), true);
  assert.equal(SERVICE_EDITABLE_FIELDS.includes("proofRequiredByDefault" as never), false);
});

test("new services receive predictable automatic catalogue order", () => {
  assert.equal(nextServiceSortOrder([]), 10);
  assert.equal(nextServiceSortOrder([10, 20, 60]), 70);
  assert.equal(nextServiceSortOrder([10_000, 0, 2]), 1);
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
    () =>
      normalizeServiceDescription(
        "x".repeat(MAX_SERVICE_DESCRIPTION_LENGTH + 1),
      ),
    ServicePolicyError,
  );
});

test("normalized slugs make conflicting names deterministic", () => {
  assert.equal(
    serviceSlugFromName("SAV / Sticker Printing"),
    serviceSlugFromName(" sav---sticker   printing "),
  );
});

test("invalid workflow defaults are rejected", () => {
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

test("public visibility is independent from online-submission eligibility", () => {
  assert.equal(
    isServicePubliclyEligible({ archivedAt: null, isActive: true }),
    true,
  );
  const visibleButOffline = validateServiceSettings({
    ...validSettings,
    isActive: true,
    onlineSubmissionEnabled: false,
  });
  assert.equal(visibleButOffline.isActive, true);
  assert.equal(visibleButOffline.onlineSubmissionEnabled, false);
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

test("the six friendly seeded services retain distinct stable slugs", () => {
  assert.equal(SEEDED_SERVICES.length, 6);
  assert.deepEqual(
    SEEDED_SERVICES.map(({ name }) => name),
    [
      "Designing",
      "Sticker Printing",
      "Banner Printing",
      "Document Printing",
      "For Sale Stickers",
      "Container Head & Batch Number Printing",
    ],
  );
  assert.equal(new Set(SEEDED_SERVICES.map(({ slug }) => slug)).size, 6);
  assert.deepEqual(
    SEEDED_SERVICES.map(({ slug }) => slug),
    [
      "designing",
      "sav-sticker-printing",
      "flexi-banner-printing",
      "document-printing",
      "for-sale-sticker-printing",
      "container-head-sticker-batch-numbers-printing",
    ],
  );
});

test("seed reconciliation changes known legacy names but preserves custom names", () => {
  const sticker = SEEDED_SERVICES[1];
  assert.equal(
    shouldReconcileSeededServiceName("SAV / Sticker Printing", sticker),
    true,
  );
  assert.equal(
    shouldReconcileSeededServiceName("Premium Decals", sticker),
    false,
  );
  assert.equal(shouldReconcileSeededServiceName(sticker.name, sticker), false);
});

test("difficulty automatically derives workload and worker-star defaults", () => {
  assert.deepEqual(serviceDifficultyDefaults("SIMPLE"), { stars: 1, workload: "QUICK" });
  assert.deepEqual(serviceDifficultyDefaults("MEDIUM"), { stars: 2, workload: "STANDARD" });
  assert.deepEqual(serviceDifficultyDefaults("COMPLEX"), { stars: 3, workload: "FOCUS" });
  const service = validateServiceSettings({ ...validSettings, defaultComplexity: "COMPLEX" });
  assert.equal(service.defaultWorkloadClass, "FOCUS");
  assert.equal("proofRequiredByDefault" in service, false);
});
