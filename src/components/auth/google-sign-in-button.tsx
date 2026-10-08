"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { safeInternalRedirect } from "@/domain/auth-policy";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface GoogleSignInButtonProps {
  beforeSignIn?: () => void;
  nextPath?: string;
}

export function GoogleSignInButton({
  beforeSignIn,
  nextPath,
}: GoogleSignInButtonProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function continueWithGoogle() {
    beforeSignIn?.();
    setErrorMessage("");
    setIsPending(true);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", safeInternalRedirect(nextPath));

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      });

      if (error) {
        setErrorMessage("Google sign-in could not be started. Please try again.");
        setIsPending(false);
      }
    } catch {
      setErrorMessage("Google sign-in is temporarily unavailable.");
      setIsPending(false);
    }
  }

  return (
    <div>
      <Button
        className="w-full"
        disabled={isPending}
        onClick={continueWithGoogle}
        variant="outline"
      >
        {isPending ? "Connecting to Google…" : "Continue with Google"}
      </Button>
      <p
        aria-live="polite"
        className="mt-3 min-h-5 text-sm text-destructive"
        role={errorMessage ? "alert" : undefined}
      >
        {errorMessage}
      </p>
    </div>
  );
}
