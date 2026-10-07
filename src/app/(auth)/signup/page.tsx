import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { PasswordAuthForm } from "@/components/auth/password-auth-form";
import { redirectAuthenticatedUser } from "@/server/auth/navigation";
import { isEmailPasswordSignupEnabled } from "@/server/auth/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  await redirectAuthenticatedUser();
  const emailSignupEnabled = isEmailPasswordSignupEnabled();

  return (
    <AuthShell
      description="Create customer access to JobSubmit. Staff roles are assigned only through authorized internal workflows."
      heading="Create your account"
    >
      <GoogleSignInButton />

      {emailSignupEnabled ? (
        <>
          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <PasswordAuthForm mode="signup" />
        </>
      ) : (
        <div className="mt-6 rounded-md border bg-surface-muted p-4 text-sm leading-6 text-muted">
          <p>
            Email signup will open after production email delivery is configured.
            Google sign-in is available now.
          </p>
          <p className="mt-3">
            Already have email/password access?{" "}
            <Link
              className="font-medium text-foreground underline decoration-accent underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/login"
            >
              Sign in
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
