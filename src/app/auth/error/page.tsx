import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign-in problem" };

interface AuthErrorPageProps {
  searchParams: Promise<{ reason?: string }>;
}

const errorMessages: Record<string, string> = {
  account:
    "We could not safely connect this sign-in to a JobSubmit account. Please contact the business if the problem continues.",
  callback:
    "This sign-in link is invalid or has expired. Start the sign-in process again.",
  confirmation:
    "This confirmation link is invalid or has expired. Request a new link before trying again.",
  provider: "Google sign-in was cancelled or could not be completed.",
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const { reason = "callback" } = await searchParams;
  const message = errorMessages[reason] ?? errorMessages.callback;

  return (
    <AuthShell description={message} heading="Sign-in problem">
      <Link
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        href="/login"
      >
        Return to sign in
      </Link>
    </AuthShell>
  );
}
