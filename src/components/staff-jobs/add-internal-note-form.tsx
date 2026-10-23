"use client";

import { useActionState } from "react";

import {
  addInternalNoteAction,
  INITIAL_STAFF_JOB_ACTION_STATE,
} from "@/app/app/staff/jobs/actions";
import { FormMessage, Textarea } from "@/components/ui/form-controls";
import { MAX_INTERNAL_NOTE_LENGTH } from "@/domain/staff-job-policy";

import { StaffJobSubmitButton } from "./staff-job-submit-button";

export function AddInternalNoteForm({
  publicReference,
}: {
  publicReference: string;
}) {
  const [state, action] = useActionState(
    addInternalNoteAction,
    INITIAL_STAFF_JOB_ACTION_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input name="publicReference" type="hidden" value={publicReference} />
      <div>
        <label className="text-sm font-medium" htmlFor="internal-note">
          New internal note
        </label>
        <Textarea
          aria-describedby="internal-note-help"
          className="mt-2"
          id="internal-note"
          maxLength={MAX_INTERNAL_NOTE_LENGTH}
          name="body"
          placeholder="Record review context for authorized staff only."
          required
          rows={5}
        />
        <p className="mt-2 text-xs leading-5 text-muted" id="internal-note-help">
          Staff-only. Customers cannot retrieve these notes. Maximum {MAX_INTERNAL_NOTE_LENGTH.toLocaleString("en-US")} characters.
        </p>
      </div>
      <StaffJobSubmitButton pendingLabel="Adding note…" variant="outline">
        Add internal note
      </StaffJobSubmitButton>
      <FormMessage message={state.message} status={state.status} />
    </form>
  );
}
