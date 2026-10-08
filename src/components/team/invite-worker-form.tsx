"use client";

import { useActionState } from "react";

import { inviteWorkerAction } from "@/app/app/team/actions";
import { FormMessage, Input } from "@/components/ui/form-controls";
import { INITIAL_TEAM_ACTION_STATE } from "@/domain/team-forms";

import { CopyInvitationLink } from "./copy-invitation-link";
import { SubmitButton } from "./submit-button";

export function InviteWorkerForm() {
  const [state, action] = useActionState(
    inviteWorkerAction,
    INITIAL_TEAM_ACTION_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="invite-email">
          Verified worker email
        </label>
        <Input
          autoCapitalize="none"
          autoComplete="email"
          className="mt-2"
          id="invite-email"
          maxLength={320}
          name="email"
          placeholder="worker@example.com"
          required
          spellCheck={false}
          type="email"
        />
      </div>
      <FormMessage message={state.message} status={state.status} />
      <SubmitButton pendingLabel="Creating invitation…" variant="accent">
        Create worker invitation
      </SubmitButton>
      {state.invitationPath ? (
        <CopyInvitationLink path={state.invitationPath} />
      ) : null}
    </form>
  );
}
