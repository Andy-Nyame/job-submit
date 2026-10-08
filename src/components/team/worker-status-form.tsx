"use client";

import { useActionState } from "react";

import { setWorkerStatusAction } from "@/app/app/team/actions";
import { FormMessage } from "@/components/ui/form-controls";
import { INITIAL_TEAM_ACTION_STATE } from "@/domain/team-forms";

import { SubmitButton } from "./submit-button";

export function WorkerStatusForm({
  active,
  membershipId,
  membershipVersion,
  profileVersion,
}: {
  active: boolean;
  membershipId: string;
  membershipVersion: number;
  profileVersion: number;
}) {
  const [state, action] = useActionState(
    setWorkerStatusAction,
    INITIAL_TEAM_ACTION_STATE,
  );
  const nextActive = !active;

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(event) => {
        if (
          !window.confirm(
            nextActive
              ? "Reactivate this worker's application access?"
              : "Deactivate this worker? Operational access will stop immediately.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="active" type="hidden" value={String(nextActive)} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <input name="membershipVersion" type="hidden" value={membershipVersion} />
      <input name="profileVersion" type="hidden" value={profileVersion} />
      <SubmitButton
        pendingLabel={nextActive ? "Activating…" : "Deactivating…"}
        variant="outline"
      >
        {nextActive ? "Reactivate worker" : "Deactivate worker"}
      </SubmitButton>
      <FormMessage message={state.message} status={state.status} />
    </form>
  );
}
