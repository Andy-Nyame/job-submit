"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";

import { redeemWorkerInvitationAction } from "@/app/invite/actions";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { FormMessage } from "@/components/ui/form-controls";
import { INITIAL_TEAM_ACTION_STATE } from "@/domain/team-forms";
import { isInvitationTokenShape } from "@/domain/team-policy";

import { SubmitButton } from "./submit-button";

const SESSION_KEY = "jobsubmit.worker-invitation";

function subscribeToBrowserState(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readInvitationToken() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const candidate = fragment.get("token") ?? window.sessionStorage.getItem(SESSION_KEY);
  return candidate && isInvitationTokenShape(candidate) ? candidate : null;
}

function subscribeToHydration() {
  return () => undefined;
}

export function RedeemInvitationPanel({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const token = useSyncExternalStore(
    subscribeToBrowserState,
    readInvitationToken,
    () => null,
  );
  const [state, action] = useActionState(
    redeemWorkerInvitationAction,
    INITIAL_TEAM_ACTION_STATE,
  );

  if (!hydrated) {
    return <p className="text-sm text-muted">Checking invitation…</p>;
  }

  if (!token && state.status !== "success") {
    return (
      <p className="text-sm leading-6 text-destructive" role="alert">
        This invitation link is incomplete or invalid. Ask a manager to reissue it.
      </p>
    );
  }

  if (!authenticated) {
    return (
      <div>
        <p className="mb-5 text-sm leading-6 text-muted">
          Sign in with the exact verified email named by the invitation. The link
          will remain in this browser session during sign-in.
        </p>
        <GoogleSignInButton
          beforeSignIn={() => {
            if (token) {
              window.sessionStorage.setItem(SESSION_KEY, token);
            }
          }}
          nextPath="/invite/redeem"
        />
        <p className="mt-4 text-center text-sm text-muted">
          Already use email and password?{" "}
          <Link
            className="font-medium text-foreground underline decoration-accent underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/login?next=/invite/redeem"
            onClick={() => {
              if (token) {
                window.sessionStorage.setItem(SESSION_KEY, token);
              }
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div>
        <FormMessage message={state.message} status={state.status} />
        <Link
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href="/app/profile"
          onClick={() => {
            window.sessionStorage.removeItem(SESSION_KEY);
          }}
        >
          View worker profile
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input name="token" type="hidden" value={token ?? ""} />
      <p className="text-sm leading-6 text-muted">
        Accepting promotes an eligible customer membership to WORKER. It cannot
        replace ADMIN or OWNER authority.
      </p>
      <FormMessage message={state.message} status={state.status} />
      <SubmitButton pendingLabel="Accepting invitation…" variant="accent">
        Accept worker invitation
      </SubmitButton>
    </form>
  );
}
