export const MEMBERSHIP_ROLES = [
  "CUSTOMER",
  "WORKER",
  "ADMIN",
  "OWNER",
] as const;

export type ApplicationRole = (typeof MEMBERSHIP_ROLES)[number];

export const BUSINESS_SLUG = "capt-bob-cedis-artworks";

export const PRIVILEGED_BOOTSTRAP_ROLES = {
  "bobcedisartworks@gmail.com": "OWNER",
  "nyameandy8@gmail.com": "ADMIN",
} as const satisfies Record<string, Extract<ApplicationRole, "ADMIN" | "OWNER">>;

export type PrivilegedBootstrapRole =
  (typeof PRIVILEGED_BOOTSTRAP_ROLES)[keyof typeof PRIVILEGED_BOOTSTRAP_ROLES];

export type IdentityBindingDecision =
  | "BIND_EXISTING_USER"
  | "CREATE_USER"
  | "REUSE_BOUND_USER";

export type ApplicationAccess =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "BUSINESS_INACTIVE"
        | "MEMBERSHIP_INACTIVE"
        | "USER_DEACTIVATED";
    };

export class IdentityBindingConflictError extends Error {
  constructor() {
    super("The authenticated identity cannot be safely linked.");
    this.name = "IdentityBindingConflictError";
  }
}

export class IdentityConfirmationRequiredError extends Error {
  constructor() {
    super("A confirmed identity is required to claim this account.");
    this.name = "IdentityConfirmationRequiredError";
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getBootstrapRole(
  email: string,
  emailVerified: boolean,
): PrivilegedBootstrapRole | null {
  if (!emailVerified) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  return PRIVILEGED_BOOTSTRAP_ROLES[
    normalizedEmail as keyof typeof PRIVILEGED_BOOTSTRAP_ROLES
  ] ?? null;
}

export function getPublicOnboardingRole(
  email: string,
  emailVerified: boolean,
): ApplicationRole {
  return getBootstrapRole(email, emailVerified) ?? "CUSTOMER";
}

export function resolveMembershipRole(
  currentRole: ApplicationRole,
  desiredRole: ApplicationRole,
): ApplicationRole {
  if (desiredRole === "CUSTOMER") {
    return currentRole;
  }

  if (desiredRole === "ADMIN") {
    return currentRole === "OWNER" ? "OWNER" : "ADMIN";
  }

  if (desiredRole === "OWNER") {
    return "OWNER";
  }

  return currentRole;
}

export function determineIdentityBinding(input: {
  authenticatedSupabaseUserId: string;
  emailMatchedUser:
    | { supabaseAuthUserId: string | null }
    | null;
  emailVerified: boolean;
  subjectMatchedUserExists: boolean;
}): IdentityBindingDecision {
  if (input.subjectMatchedUserExists) {
    return "REUSE_BOUND_USER";
  }

  if (!input.emailMatchedUser) {
    return "CREATE_USER";
  }

  if (
    input.emailMatchedUser.supabaseAuthUserId ===
    input.authenticatedSupabaseUserId
  ) {
    return "REUSE_BOUND_USER";
  }

  if (input.emailMatchedUser.supabaseAuthUserId) {
    throw new IdentityBindingConflictError();
  }

  if (!input.emailVerified) {
    throw new IdentityConfirmationRequiredError();
  }

  return "BIND_EXISTING_USER";
}

export function evaluateApplicationAccess(input: {
  businessArchivedAt: Date | null;
  businessIsActive: boolean;
  membershipDeactivatedAt: Date | null;
  membershipStatus: "ACTIVE" | "INACTIVE";
  userDeactivatedAt: Date | null;
}): ApplicationAccess {
  if (input.userDeactivatedAt) {
    return { allowed: false, reason: "USER_DEACTIVATED" };
  }

  if (!input.businessIsActive || input.businessArchivedAt) {
    return { allowed: false, reason: "BUSINESS_INACTIVE" };
  }

  if (
    input.membershipStatus !== "ACTIVE" ||
    input.membershipDeactivatedAt
  ) {
    return { allowed: false, reason: "MEMBERSHIP_INACTIVE" };
  }

  return { allowed: true };
}

export function hasRole(
  actualRole: ApplicationRole,
  requiredRole: ApplicationRole,
) {
  return actualRole === requiredRole;
}

export function hasAnyRole(
  actualRole: ApplicationRole,
  allowedRoles: readonly ApplicationRole[],
) {
  return allowedRoles.includes(actualRole);
}

export function safeInternalRedirect(
  candidate: string | null | undefined,
  fallback = "/app",
) {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://jobsubmit.invalid");
    const resolved = new URL(candidate, base);

    if (resolved.origin !== base.origin) {
      return fallback;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function initialDisplayName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= 2 ? normalized.slice(0, 160) : null;
}
