"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { manageInvitationAction } from "@/app/app/team/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-controls";
import { INITIAL_TEAM_ACTION_STATE } from "@/domain/team-forms";

import { CopyInvitationLink } from "./copy-invitation-link";

function InvitationActionButton({
  intent,
}: {
  intent: "reissue" | "revoke";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      disabled={pending}
      name="intent"
      onClick={(event) => {
        if (
          intent === "revoke" &&
          !window.confirm(
            "Revoke this invitation? The current link will stop working immediately.",
          )
        ) {
          event.preventDefault();
        }
      }}
      type="submit"
      value={intent}
      variant="outline"
    >
      {pending ? "Working…" : intent === "reissue" ? "Reissue link" : "Revoke"}
    </Button>
  );
}

export function InvitationControls({
  canReissue,
  canRevoke,
  invitationId,
  version,
}: {
  canReissue: boolean;
  canRevoke: boolean;
  invitationId: string;
  version: number;
}) {
  const [state, action] = useActionState(
    manageInvitationAction,
    INITIAL_TEAM_ACTION_STATE,
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="invitationId" type="hidden" value={invitationId} />
      <input name="version" type="hidden" value={version} />
      <div className="flex flex-wrap gap-2">
        {canReissue ? <InvitationActionButton intent="reissue" /> : null}
        {canRevoke ? <InvitationActionButton intent="revoke" /> : null}
      </div>
      <FormMessage message={state.message} status={state.status} />
      {state.invitationPath ? (
        <CopyInvitationLink path={state.invitationPath} />
      ) : null}
    </form>
  );
}
