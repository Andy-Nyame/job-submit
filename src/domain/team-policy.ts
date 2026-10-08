import {
  normalizeEmail,
  type ApplicationRole,
} from "./auth-policy";

export const TEAM_MANAGER_ROLES = ["OWNER", "ADMIN"] as const;
export const WORKER_INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
export const MAX_QUICK_WORKLOAD = 50;
export const MAX_STANDARD_WORKLOAD = 20;

export type InvitationLifecycleStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";

export type WorkloadKind = "QUICK" | "STANDARD" | "FOCUS";

export class TeamPolicyError extends Error {
  constructor(
    public readonly code:
      | "BUSINESS_MISMATCH"
      | "INVITATION_EMAIL_MISMATCH"
      | "INVITATION_UNAVAILABLE"
      | "PRIVILEGED_MEMBERSHIP_PROTECTED"
      | "TEAM_MANAGER_REQUIRED"
      | "VERIFIED_EMAIL_REQUIRED"
      | "WORKER_SETTINGS_INVALID",
  ) {
    super(code);
    this.name = "TeamPolicyError";
  }
}

export function canManageWorkers(role: ApplicationRole) {
  return TEAM_MANAGER_ROLES.some((allowedRole) => allowedRole === role);
}

export function assertCanManageWorkers(role: ApplicationRole) {
  if (!canManageWorkers(role)) {
    throw new TeamPolicyError("TEAM_MANAGER_REQUIRED");
  }
}

export function normalizeInvitationEmail(email: string) {
  return normalizeEmail(email);
}

export function isValidInvitationEmail(email: string) {
  const normalized = normalizeInvitationEmail(email);
  return (
    normalized.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  );
}

export function isInvitationTokenShape(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function getInvitationLifecycleStatus(
  invitation: { expiresAt: Date; status: InvitationLifecycleStatus },
  now = new Date(),
): InvitationLifecycleStatus {
  if (invitation.status === "PENDING" && invitation.expiresAt <= now) {
    return "EXPIRED";
  }

  return invitation.status;
}

export function hasLivePendingInvitation(
  invitations: readonly {
    email: string;
    expiresAt: Date;
    status: InvitationLifecycleStatus;
  }[],
  requestedEmail: string,
  now = new Date(),
) {
  const normalizedEmail = normalizeInvitationEmail(requestedEmail);
  return invitations.some(
    (invitation) =>
      normalizeInvitationEmail(invitation.email) === normalizedEmail &&
      getInvitationLifecycleStatus(invitation, now) === "PENDING",
  );
}

export function assertInvitationIdentity(input: {
  authenticatedEmail: string;
  emailVerified: boolean;
  invitationEmail: string;
}) {
  if (!input.emailVerified) {
    throw new TeamPolicyError("VERIFIED_EMAIL_REQUIRED");
  }

  if (
    normalizeInvitationEmail(input.authenticatedEmail) !==
    normalizeInvitationEmail(input.invitationEmail)
  ) {
    throw new TeamPolicyError("INVITATION_EMAIL_MISMATCH");
  }
}

export function assertInvitationAvailable(
  invitation: { expiresAt: Date; status: InvitationLifecycleStatus },
  now = new Date(),
) {
  if (getInvitationLifecycleStatus(invitation, now) !== "PENDING") {
    throw new TeamPolicyError("INVITATION_UNAVAILABLE");
  }
}

export function resolveInvitedMembershipRole(currentRole: ApplicationRole) {
  if (currentRole === "ADMIN" || currentRole === "OWNER") {
    throw new TeamPolicyError("PRIVILEGED_MEMBERSHIP_PROTECTED");
  }

  return "WORKER" as const;
}

export interface WorkerCapacitySettings {
  canTakeFocus: boolean;
  maxQuickWorkload: number;
  maxStandardWorkload: number;
}

export function validateWorkerCapacity(
  settings: WorkerCapacitySettings,
): WorkerCapacitySettings {
  if (
    !Number.isSafeInteger(settings.maxQuickWorkload) ||
    settings.maxQuickWorkload < 0 ||
    settings.maxQuickWorkload > MAX_QUICK_WORKLOAD ||
    !Number.isSafeInteger(settings.maxStandardWorkload) ||
    settings.maxStandardWorkload < 0 ||
    settings.maxStandardWorkload > MAX_STANDARD_WORKLOAD
  ) {
    throw new TeamPolicyError("WORKER_SETTINGS_INVALID");
  }

  return settings;
}

export function canAcceptConfiguredWorkload(input: {
  activeFocusAssignments: number;
  activeQuickAssignments: number;
  activeStandardAssignments: number;
  isOperational: boolean;
  requested: WorkloadKind;
  settings: WorkerCapacitySettings;
}) {
  if (!input.isOperational) {
    return false;
  }

  if (input.requested === "QUICK") {
    return input.activeQuickAssignments < input.settings.maxQuickWorkload;
  }

  if (input.requested === "STANDARD") {
    return (
      input.activeFocusAssignments === 0 &&
      input.activeStandardAssignments < input.settings.maxStandardWorkload
    );
  }

  return (
    input.settings.canTakeFocus &&
    input.activeFocusAssignments === 0 &&
    input.activeStandardAssignments === 0
  );
}

export function isWorkerOperational(input: {
  businessActive: boolean;
  businessArchived: boolean;
  membershipActive: boolean;
  profileActive: boolean;
  profileArchived: boolean;
  userActive: boolean;
}) {
  return (
    input.businessActive &&
    !input.businessArchived &&
    input.membershipActive &&
    input.profileActive &&
    !input.profileArchived &&
    input.userActive
  );
}

export function assertSameBusiness(expected: string, actual: string) {
  if (expected !== actual) {
    throw new TeamPolicyError("BUSINESS_MISMATCH");
  }
}

export function canApplyVersionedMutation(
  currentVersion: number,
  expectedVersion: number,
) {
  return currentVersion === expectedVersion;
}
