"use server";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@/domain/auth-forms";
import { normalizeEmail, safeInternalRedirect } from "@/domain/auth-policy";
import { getApplicationPrincipal } from "@/server/auth/authorization";
import { isEmailPasswordSignupEnabled } from "@/server/auth/settings";
import { createServerSupabaseClient } from "@/server/auth/supabase";

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function validateEmail(email: string) {
  return (
    email.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function validateCredentials(formData: FormData) {
  const email = normalizeEmail(readText(formData, "email"));
  const password = readText(formData, "password");
  const fieldErrors: NonNullable<AuthActionState["fieldErrors"]> = {};

  if (!validateEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  }

  return { email, fieldErrors, password };
}

export async function loginWithPassword(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { email, fieldErrors, password } = validateCredentials(formData);

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createServerSupabaseClient({
    requireCookieWrites: true,
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      message: "We could not sign you in with those details. Please try again.",
    };
  }

  let destination = safeInternalRedirect(readText(formData, "next"));

  try {
    const principal = await getApplicationPrincipal(supabase);
    if (!principal) {
      return { message: "We could not verify this sign-in. Please try again." };
    }

    destination = principal.access.allowed ? destination : "/access-denied";
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    return { message: "We could not complete this sign-in. Please try again." };
  }

  redirect(destination);
}

export async function signupWithPassword(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isEmailPasswordSignupEnabled()) {
    return {
      message:
        "Email signup is not available yet. Please continue with Google.",
    };
  }

  const { email, fieldErrors, password } = validateCredentials(formData);
  const name = readText(formData, "name").trim().replace(/\s+/g, " ");

  if (name.length < 2 || name.length > 160) {
    fieldErrors.name = "Enter your name using 2 to 160 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createServerSupabaseClient({
    requireCookieWrites: true,
  });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) {
    return {
      message:
        "We could not complete signup. Check your details and try again.",
    };
  }

  if (!data.session) {
    return {
      message:
        "Check your email to confirm your address before signing in.",
      success: true,
    };
  }

  let destination: string;

  try {
    const principal = await getApplicationPrincipal(supabase);
    if (!principal) {
      return { message: "We could not verify this signup. Please try again." };
    }
    destination = principal.access.allowed ? "/app" : "/access-denied";
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    return { message: "We could not complete signup. Please try again." };
  }

  redirect(destination);
}

export async function logout() {
  const supabase = await createServerSupabaseClient({
    requireCookieWrites: true,
  });
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?status=signed-out");
}
