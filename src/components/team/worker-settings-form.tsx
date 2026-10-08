"use client";

import { useActionState } from "react";

import { updateWorkerAction } from "@/app/app/team/actions";
import { FormMessage, Input } from "@/components/ui/form-controls";
import { INITIAL_TEAM_ACTION_STATE } from "@/domain/team-forms";
import {
  MAX_QUICK_WORKLOAD,
  MAX_STANDARD_WORKLOAD,
} from "@/domain/team-policy";

import { SubmitButton } from "./submit-button";

interface ServiceOption {
  checked: boolean;
  id: string;
  name: string;
}

export function WorkerSettingsForm({
  canTakeFocus,
  displayName,
  maxQuickWorkload,
  maxStandardWorkload,
  membershipId,
  profileVersion,
  services,
}: {
  canTakeFocus: boolean;
  displayName: string;
  maxQuickWorkload: number;
  maxStandardWorkload: number;
  membershipId: string;
  profileVersion: number;
  services: ServiceOption[];
}) {
  const [state, action] = useActionState(
    updateWorkerAction,
    INITIAL_TEAM_ACTION_STATE,
  );

  return (
    <form action={action} className="space-y-6">
      <input name="membershipId" type="hidden" value={membershipId} />
      <input name="profileVersion" type="hidden" value={profileVersion} />

      <div>
        <label className="text-sm font-medium" htmlFor="display-name">
          Display name
        </label>
        <Input
          className="mt-2"
          defaultValue={displayName}
          id="display-name"
          maxLength={160}
          minLength={2}
          name="displayName"
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor="quick-capacity">
            QUICK capacity
          </label>
          <Input
            className="mt-2"
            defaultValue={maxQuickWorkload}
            id="quick-capacity"
            max={MAX_QUICK_WORKLOAD}
            min={0}
            name="maxQuickWorkload"
            required
            type="number"
          />
          <p className="mt-1.5 text-xs text-muted">0–{MAX_QUICK_WORKLOAD}</p>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="standard-capacity">
            STANDARD capacity
          </label>
          <Input
            className="mt-2"
            defaultValue={maxStandardWorkload}
            id="standard-capacity"
            max={MAX_STANDARD_WORKLOAD}
            min={0}
            name="maxStandardWorkload"
            required
            type="number"
          />
          <p className="mt-1.5 text-xs text-muted">0–{MAX_STANDARD_WORKLOAD}</p>
        </div>
      </div>

      <label className="flex min-h-11 items-start gap-3 rounded-md border bg-surface-muted p-4 text-sm">
        <input
          className="mt-1 size-4 accent-[var(--accent)]"
          defaultChecked={canTakeFocus}
          name="canTakeFocus"
          type="checkbox"
        />
        <span>
          <span className="font-medium">FOCUS eligible</span>
          <span className="mt-1 block leading-5 text-muted">
            FOCUS work excludes simultaneous STANDARD or FOCUS work. QUICK work
            remains limited by QUICK capacity.
          </span>
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Qualified services</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {services.map((service) => (
            <label
              className="flex min-h-11 items-center gap-3 rounded-md border p-3 text-sm"
              key={service.id}
            >
              <input
                className="size-4 accent-[var(--accent)]"
                defaultChecked={service.checked}
                name="serviceIds"
                type="checkbox"
                value={service.id}
              />
              {service.name}
            </label>
          ))}
        </div>
      </fieldset>

      <FormMessage message={state.message} status={state.status} />
      <SubmitButton pendingLabel="Saving worker…">Save worker settings</SubmitButton>
    </form>
  );
}
