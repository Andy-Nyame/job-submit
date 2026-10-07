"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  loginWithPassword,
  signupWithPassword,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/domain/auth-forms";
import { safeInternalRedirect } from "@/domain/auth-policy";

interface PasswordAuthFormProps {
  mode: "login" | "signup";
  nextPath?: string;
}

const inputClassName =
  "min-h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted/75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1.5 text-sm text-destructive">{message}</p>
  ) : null;
}

export function PasswordAuthForm({ mode, nextPath }: PasswordAuthFormProps) {
  const action = mode === "login" ? loginWithPassword : signupWithPassword;
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    action,
    INITIAL_AUTH_ACTION_STATE,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {mode === "signup" ? (
        <div>
          <label className="text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input
            aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            autoComplete="name"
            className={`${inputClassName} mt-2`}
            disabled={pending}
            id="name"
            maxLength={160}
            name="name"
            required
            type="text"
          />
          <div id="name-error">
            <FieldError message={state.fieldErrors?.name} />
          </div>
        </div>
      ) : null}

      <div>
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          autoCapitalize="none"
          autoComplete="email"
          className={`${inputClassName} mt-2`}
          disabled={pending}
          id="email"
          maxLength={320}
          name="email"
          required
          spellCheck={false}
          type="email"
        />
        <div id="email-error">
          <FieldError message={state.fieldErrors?.email} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={`${inputClassName} mt-2`}
          disabled={pending}
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <div id="password-error">
          <FieldError message={state.fieldErrors?.password} />
        </div>
      </div>

      <input
        name="next"
        type="hidden"
        value={safeInternalRedirect(nextPath)}
      />

      <p
        aria-live="polite"
        className={
          state.success
            ? "min-h-5 text-sm text-foreground"
            : "min-h-5 text-sm text-destructive"
        }
        role={state.message && !state.success ? "alert" : undefined}
      >
        {state.message}
      </p>

      <Button className="w-full" disabled={pending} type="submit">
        {pending
          ? mode === "login"
            ? "Signing in…"
            : "Creating account…"
          : mode === "login"
            ? "Sign in"
            : "Create customer account"}
      </Button>

      <p className="text-center text-sm text-muted">
        {mode === "login" ? "New to JobSubmit?" : "Already have an account?"}{" "}
        <Link
          className="font-medium text-foreground underline decoration-accent underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={mode === "login" ? "/signup" : "/login"}
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
