import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import {
  hasAnyRole,
  hasRole,
  type ApplicationRole,
} from "@/domain/auth-policy";

import {
  ApplicationAccessDeniedError,
  AuthenticationRequiredError,
  RoleRequiredError,
} from "./errors";
import { getAuthenticatedIdentity } from "./identity";
import {
  type ApplicationPrincipal,
  resolveApplicationPrincipal,
} from "./provisioning";

export async function requireAuthenticatedUser(
  suppliedClient?: SupabaseClient,
) {
  const identity = await getAuthenticatedIdentity(suppliedClient);
  if (!identity) {
    throw new AuthenticationRequiredError();
  }
  return identity;
}

export async function getApplicationPrincipal(
  suppliedClient?: SupabaseClient,
) {
  if (!suppliedClient) {
    return getCachedApplicationPrincipal();
  }

  const identity = await getAuthenticatedIdentity(suppliedClient);
  return identity ? resolveApplicationPrincipal(identity) : null;
}

const getCachedApplicationPrincipal = cache(async () => {
  const identity = await getAuthenticatedIdentity();
  return identity ? resolveApplicationPrincipal(identity) : null;
});

export async function requireBusinessMembership(
  suppliedClient?: SupabaseClient,
) {
  const principal = await getApplicationPrincipal(suppliedClient);

  if (!principal) {
    throw new AuthenticationRequiredError();
  }

  if (!principal.access.allowed) {
    throw new ApplicationAccessDeniedError();
  }

  return principal;
}

export async function requireRole(
  requiredRole: ApplicationRole,
  suppliedClient?: SupabaseClient,
) {
  const principal = await requireBusinessMembership(suppliedClient);
  if (!hasRole(principal.role, requiredRole)) {
    throw new RoleRequiredError();
  }
  return principal;
}

export async function requireAnyRole(
  allowedRoles: readonly ApplicationRole[],
  suppliedClient?: SupabaseClient,
) {
  const principal = await requireBusinessMembership(suppliedClient);
  if (!hasAnyRole(principal.role, allowedRoles)) {
    throw new RoleRequiredError();
  }
  return principal;
}

export function isActivePrincipal(
  principal: ApplicationPrincipal | null,
): principal is ApplicationPrincipal & { access: { allowed: true } } {
  return Boolean(principal?.access.allowed);
}
