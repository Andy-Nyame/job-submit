import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { initialDisplayName, normalizeEmail } from "@/domain/auth-policy";

import { AuthenticationUnavailableError } from "./errors";
import { createServerSupabaseClient } from "./supabase";

export interface AuthenticatedIdentity {
  displayName: string | null;
  email: string;
  emailVerified: boolean;
  supabaseUserId: string;
}

function isMissingSessionError(error: { code?: string; name?: string }) {
  return (
    error.code === "session_not_found" ||
    error.name === "AuthSessionMissingError"
  );
}

export async function getAuthenticatedIdentity(
  suppliedClient?: SupabaseClient,
): Promise<AuthenticatedIdentity | null> {
  const supabase = suppliedClient ?? (await createServerSupabaseClient());
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    if (isMissingSessionError(claimsError)) {
      return null;
    }
    throw new AuthenticationUnavailableError();
  }

  const subject = claimsData?.claims?.sub;
  if (!subject) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    if (isMissingSessionError(userError)) {
      return null;
    }
    throw new AuthenticationUnavailableError();
  }

  const user = userData.user;
  if (!user || user.id !== subject || !user.email) {
    throw new AuthenticationUnavailableError();
  }

  return {
    displayName:
      initialDisplayName(user.user_metadata.full_name) ??
      initialDisplayName(user.user_metadata.name),
    email: normalizeEmail(user.email),
    emailVerified: Boolean(user.email_confirmed_at),
    supabaseUserId: user.id,
  };
}
