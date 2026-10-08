import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanManageWorkers,
  assertInvitationAvailable,
  assertInvitationIdentity,
  assertSameBusiness,
  canAcceptConfiguredWorkload,
  canApplyVersionedMutation,
  canManageWorkers,
  getInvitationLifecycleStatus,
  hasLivePendingInvitation,
  isInvitationTokenShape,
  isValidInvitationEmail,
  isWorkerOperational,
  MAX_QUICK_WORKLOAD,
  MAX_STANDARD_WORKLOAD,
  normalizeInvitationEmail,
  resolveInvitedMembershipRole,
  TeamPolicyError,
  validateWorkerCapacity,
} from "./team-policy";

test("only OWNER and ADMIN can manage workers", () => {
  assert.equal(canManageWorkers("OWNER"), true);
  assert.equal(canManageWorkers("ADMIN"), true);
  assert.equal(canManageWorkers("WORKER"), false);
  assert.equal(canManageWorkers("CUSTOMER"), false);
  assert.throws(() => assertCanManageWorkers("WORKER"), TeamPolicyError);
  assert.throws(() => assertCanManageWorkers("CUSTOMER"), TeamPolicyError);
});

test("invitation email is normalized and validated", () => {
  assert.equal(
    normalizeInvitationEmail("  Worker@Example.COM "),
    "worker@example.com",
  );
  assert.equal(isValidInvitationEmail("worker@example.com"), true);
  assert.equal(isValidInvitationEmail("not-an-email"), false);
});

test("redemption requires an exact verified normalized email", () => {
  assert.doesNotThrow(() =>
    assertInvitationIdentity({
      authenticatedEmail: " worker@example.com ",
      emailVerified: true,
      invitationEmail: "WORKER@EXAMPLE.COM",
    }),
  );
  assert.throws(
    () =>
      assertInvitationIdentity({
        authenticatedEmail: "worker@example.com",
        emailVerified: false,
        invitationEmail: "worker@example.com",
      }),
    TeamPolicyError,
  );
  assert.throws(
    () =>
      assertInvitationIdentity({
        authenticatedEmail: "other@example.com",
        emailVerified: true,
        invitationEmail: "worker@example.com",
      }),
    TeamPolicyError,
  );
});

test("random invitation tokens have the required public shape", () => {
  assert.equal(
    isInvitationTokenShape("V5mO2rmbMdlJ9mtMtLz3c9oZLCPUpYtJ5f0cYvLDrGQ"),
    true,
  );
  assert.equal(isInvitationTokenShape("short"), false);
  assert.equal(isInvitationTokenShape("x".repeat(42) + "+"), false);
});

test("pending invitations become expired at their deadline", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  assert.equal(
    getInvitationLifecycleStatus(
      { expiresAt: new Date("2026-10-08T12:00:01.000Z"), status: "PENDING" },
      now,
    ),
    "PENDING",
  );
  assert.equal(
    getInvitationLifecycleStatus(
      { expiresAt: new Date("2026-10-08T12:00:00.000Z"), status: "PENDING" },
      now,
    ),
    "EXPIRED",
  );
});

test("duplicate handling detects only a live pending invite for the same email", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  const invitations = [
    {
      email: "WORKER@example.com",
      expiresAt: new Date("2026-10-09T12:00:00.000Z"),
      status: "PENDING" as const,
    },
    {
      email: "old@example.com",
      expiresAt: new Date("2026-10-07T12:00:00.000Z"),
      status: "PENDING" as const,
    },
  ];
  assert.equal(
    hasLivePendingInvitation(invitations, " worker@EXAMPLE.com ", now),
    true,
  );
  assert.equal(
    hasLivePendingInvitation(invitations, "old@example.com", now),
    false,
  );
});

test("invalid, expired, revoked, and used invitations cannot redeem", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  for (const status of ["ACCEPTED", "REVOKED", "EXPIRED"] as const) {
    assert.throws(
      () =>
        assertInvitationAvailable(
          { expiresAt: new Date("2026-10-09T12:00:00.000Z"), status },
          now,
        ),
      TeamPolicyError,
    );
  }
  assert.throws(
    () =>
      assertInvitationAvailable(
        { expiresAt: new Date("2026-10-07T12:00:00.000Z"), status: "PENDING" },
        now,
      ),
    TeamPolicyError,
  );
});

test("valid invitations promote CUSTOMER and preserve WORKER", () => {
  assert.equal(resolveInvitedMembershipRole("CUSTOMER"), "WORKER");
  assert.equal(resolveInvitedMembershipRole("WORKER"), "WORKER");
});

test("worker invitations cannot overwrite ADMIN or OWNER", () => {
  assert.throws(() => resolveInvitedMembershipRole("ADMIN"), TeamPolicyError);
  assert.throws(() => resolveInvitedMembershipRole("OWNER"), TeamPolicyError);
});

test("optimistic versions reject concurrent stale redemption or edits", () => {
  assert.equal(canApplyVersionedMutation(3, 3), true);
  assert.equal(canApplyVersionedMutation(4, 3), false);
});

test("capacity bounds accept sensible nonnegative integers", () => {
  assert.deepEqual(
    validateWorkerCapacity({
      canTakeFocus: true,
      maxQuickWorkload: MAX_QUICK_WORKLOAD,
      maxStandardWorkload: MAX_STANDARD_WORKLOAD,
    }),
    {
      canTakeFocus: true,
      maxQuickWorkload: 50,
      maxStandardWorkload: 20,
    },
  );
});

test("capacity rejects negatives, fractions, and excessive values", () => {
  for (const value of [-1, 1.5, MAX_QUICK_WORKLOAD + 1]) {
    assert.throws(
      () =>
        validateWorkerCapacity({
          canTakeFocus: false,
          maxQuickWorkload: value,
          maxStandardWorkload: 0,
        }),
      TeamPolicyError,
    );
  }
  assert.throws(
    () =>
      validateWorkerCapacity({
        canTakeFocus: false,
        maxQuickWorkload: 0,
        maxStandardWorkload: MAX_STANDARD_WORKLOAD + 1,
      }),
    TeamPolicyError,
  );
});

test("FOCUS excludes concurrent STANDARD or FOCUS work", () => {
  const base = {
    activeQuickAssignments: 0,
    activeStandardAssignments: 0,
    isOperational: true,
    settings: {
      canTakeFocus: true,
      maxQuickWorkload: 2,
      maxStandardWorkload: 2,
    },
  };
  assert.equal(
    canAcceptConfiguredWorkload({
      ...base,
      activeFocusAssignments: 1,
      requested: "STANDARD",
    }),
    false,
  );
  assert.equal(
    canAcceptConfiguredWorkload({
      ...base,
      activeFocusAssignments: 0,
      activeStandardAssignments: 1,
      requested: "FOCUS",
    }),
    false,
  );
});

test("limited QUICK work remains capacity-based during FOCUS", () => {
  const settings = {
    canTakeFocus: true,
    maxQuickWorkload: 2,
    maxStandardWorkload: 1,
  };
  assert.equal(
    canAcceptConfiguredWorkload({
      activeFocusAssignments: 1,
      activeQuickAssignments: 1,
      activeStandardAssignments: 0,
      isOperational: true,
      requested: "QUICK",
      settings,
    }),
    true,
  );
  assert.equal(
    canAcceptConfiguredWorkload({
      activeFocusAssignments: 1,
      activeQuickAssignments: 2,
      activeStandardAssignments: 0,
      isOperational: true,
      requested: "QUICK",
      settings,
    }),
    false,
  );
});

test("blocked records cannot be operational or reactivated implicitly", () => {
  const active = {
    businessActive: true,
    businessArchived: false,
    membershipActive: true,
    profileActive: true,
    profileArchived: false,
    userActive: true,
  };
  assert.equal(isWorkerOperational(active), true);
  assert.equal(isWorkerOperational({ ...active, userActive: false }), false);
  assert.equal(isWorkerOperational({ ...active, membershipActive: false }), false);
  assert.equal(isWorkerOperational({ ...active, businessActive: false }), false);
});

test("business isolation rejects cross-business targets", () => {
  assert.doesNotThrow(() => assertSameBusiness("business-a", "business-a"));
  assert.throws(
    () => assertSameBusiness("business-a", "business-b"),
    TeamPolicyError,
  );
});
