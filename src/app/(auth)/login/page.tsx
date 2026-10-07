import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { PasswordAuthForm } from "@/components/auth/password-auth-form";
import { safeInternalRedirect } from "@/domain/auth-policy";
import { redirectAuthenticatedUser } from "@/server/auth/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; status?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await redirectAuthenticatedUser();
  const params = await searchParams;
  const nextPath = safeInternalRedirect(params.next);

  return (
    <AuthShell
      description="Access your JobSubmit workspace securely."
      heading="Welcome back"
    >
      {params.status === "signed-out" ? (
        <p
          className="mb-5 rounded-md border bg-surface-muted px-4 py-3 text-sm"
          role="status"
        >
          You have been signed out.
        </p>
      ) : null}
      <GoogleSignInButton nextPath={nextPath} />
      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-xs uppercase tracking-wider text-muted">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <PasswordAuthForm mode="login" nextPath={nextPath} />
    </AuthShell>
  );
}
