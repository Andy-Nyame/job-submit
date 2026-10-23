"use client";

import { useActionState } from "react";

import {
  INITIAL_STAFF_JOB_ACTION_STATE,
  startJobReviewAction,
} from "@/app/app/staff/jobs/actions";
import { FormMessage } from "@/components/ui/form-controls";

import { StaffJobSubmitButton } from "./staff-job-submit-button";

export function StartJobReviewForm({
  publicReference,
  version,
}: {
  publicReference: string;
  version: number;
}) {
  const [state, action] = useActionState(
    startJobReviewAction,
    INITIAL_STAFF_JOB_ACTION_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input name="publicReference" type="hidden" value={publicReference} />
      <input name="version" type="hidden" value={version} />
      <StaffJobSubmitButton className="w-full" pendingLabel="Starting review…">
        Start staff review
      </StaffJobSubmitButton>
      <FormMessage message={state.message} status={state.status} />
    </form>
  );
}
