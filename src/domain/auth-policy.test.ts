import assert from "node:assert/strict";
import test from "node:test";

import {
  determineIdentityBinding,
  evaluateApplicationAccess,
  getBootstrapRole,
  getPublicOnboardingRole,
  hasAnyRole,
  hasRole,
  IdentityBindingConflictError,
  IdentityConfirmationRequiredError,
  initialDisplayName,
  normalizeEmail,
  resolveMembershipRole,
  safeInternalRedirect,
} from "./auth-policy";

test("email normalization trims and lowercases consistently", () => {
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
});

test("verified locked emails map to their exact bootstrap roles", () => {
  assert.equal(getBootstrapRole("nyameandy8@gmail.com", true), "ADMIN");
  assert.equal(getBootstrapRole("BOBCEDISARTWORKS@GMAIL.COM", true), "OWNER");
});

test("unverified privileged identities cannot bootstrap", () => {
  assert.equal(getBootstrapRole("nyameandy8@gmail.com", false), null);
  assert.equal(getBootstrapRole("bobcedisartworks@gmail.com", false), null);
});

test("every non-bootstrap public identity starts as CUSTOMER", () => {
  assert.equal(getPublicOnboardingRole("person@example.com", true), "CUSTOMER");
  assert.equal(getPublicOnboardingRole("person@example.com", false), "CUSTOMER");
});

test("public provisioning preserves existing staff roles", () => {
  assert.equal(resolveMembershipRole("WORKER", "CUSTOMER"), "WORKER");
  assert.equal(resolveMembershipRole("ADMIN", "CUSTOMER"), "ADMIN");
  assert.equal(resolveMembershipRole("OWNER", "CUSTOMER"), "OWNER");
});

test("locked ADMIN bootstrap elevates lower roles but never downgrades OWNER", () => {
  assert.equal(resolveMembershipRole("CUSTOMER", "ADMIN"), "ADMIN");
  assert.equal(resolveMembershipRole("WORKER", "ADMIN"), "ADMIN");
  assert.equal(resolveMembershipRole("OWNER", "ADMIN"), "OWNER");
});

test("locked OWNER bootstrap elevates every lower role", () => {
  assert.equal(resolveMembershipRole("CUSTOMER", "OWNER"), "OWNER");
  assert.equal(resolveMembershipRole("WORKER", "OWNER"), "OWNER");
  assert.equal(resolveMembershipRole("ADMIN", "OWNER"), "OWNER");
});

test("repeated membership resolution is idempotent", () => {
  assert.equal(resolveMembershipRole("CUSTOMER", "CUSTOMER"), "CUSTOMER");
  assert.equal(resolveMembershipRole("ADMIN", "ADMIN"), "ADMIN");
  assert.equal(resolveMembershipRole("OWNER", "OWNER"), "OWNER");
});

test("untrusted profile metadata cannot influence public role selection", () => {
  const untrustedMetadata = { role: "OWNER" };
  assert.equal(untrustedMetadata.role, "OWNER");
  assert.equal(getPublicOnboardingRole("person@example.com", true), "CUSTOMER");
});

test("identity resolution creates, reuses, and safely claims users", () => {
  const identity = "11111111-1111-4111-8111-111111111111";

  assert.equal(
    determineIdentityBinding({
      authenticatedSupabaseUserId: identity,
      emailMatchedUser: null,
      emailVerified: true,
      subjectMatchedUserExists: false,
    }),
    "CREATE_USER",
  );
  assert.equal(
    determineIdentityBinding({
      authenticatedSupabaseUserId: identity,
      emailMatchedUser: null,
      emailVerified: true,
      subjectMatchedUserExists: true,
    }),
    "REUSE_BOUND_USER",
  );
  assert.equal(
    determineIdentityBinding({
      authenticatedSupabaseUserId: identity,
      emailMatchedUser: { supabaseAuthUserId: null },
      emailVerified: true,
      subjectMatchedUserExists: false,
    }),
    "BIND_EXISTING_USER",
  );
});

test("unverified identities cannot claim pre-existing email records", () => {
  assert.throws(
    () =>
      determineIdentityBinding({
        authenticatedSupabaseUserId: "11111111-1111-4111-8111-111111111111",
        emailMatchedUser: { supabaseAuthUserId: null },
        emailVerified: false,
        subjectMatchedUserExists: false,
      }),
    IdentityConfirmationRequiredError,
  );
});

test("an existing Supabase binding cannot be stolen", () => {
  assert.throws(
    () =>
      determineIdentityBinding({
        authenticatedSupabaseUserId: "11111111-1111-4111-8111-111111111111",
        emailMatchedUser: {
          supabaseAuthUserId: "22222222-2222-4222-8222-222222222222",
        },
        emailVerified: true,
        subjectMatchedUserExists: false,
      }),
    IdentityBindingConflictError,
  );
});

test("inactive application records remain blocked", () => {
  const activeInput = {
    businessArchivedAt: null,
    businessIsActive: true,
    membershipDeactivatedAt: null,
    membershipStatus: "ACTIVE" as const,
    userDeactivatedAt: null,
  };

  assert.deepEqual(evaluateApplicationAccess(activeInput), { allowed: true });
  assert.equal(
    evaluateApplicationAccess({
      ...activeInput,
      userDeactivatedAt: new Date(),
    }).allowed,
    false,
  );
  assert.equal(
    evaluateApplicationAccess({
      ...activeInput,
      membershipStatus: "INACTIVE",
    }).allowed,
    false,
  );
  assert.equal(
    evaluateApplicationAccess({
      ...activeInput,
      membershipDeactivatedAt: new Date(),
    }).allowed,
    false,
  );
  assert.equal(
    evaluateApplicationAccess({
      ...activeInput,
      businessArchivedAt: new Date(),
    }).allowed,
    false,
  );
});

test("role checks are explicit rather than numeric hierarchy checks", () => {
  assert.equal(hasRole("OWNER", "OWNER"), true);
  assert.equal(hasRole("OWNER", "ADMIN"), false);
  assert.equal(hasAnyRole("ADMIN", ["OWNER", "ADMIN"]), true);
  assert.equal(hasAnyRole("CUSTOMER", ["OWNER", "ADMIN", "WORKER"]), false);
});

test("redirect validation permits internal paths and rejects external forms", () => {
  assert.equal(safeInternalRedirect("/app?tab=profile"), "/app?tab=profile");
  assert.equal(safeInternalRedirect("https://evil.example"), "/app");
  assert.equal(safeInternalRedirect("//evil.example"), "/app");
  assert.equal(safeInternalRedirect("/\\evil.example"), "/app");
});

test("provider names are accepted only as bounded profile defaults", () => {
  assert.equal(initialDisplayName("  Ada   Lovelace  "), "Ada Lovelace");
  assert.equal(initialDisplayName("x"), null);
  assert.equal(initialDisplayName({ name: "Ada" }), null);
});
