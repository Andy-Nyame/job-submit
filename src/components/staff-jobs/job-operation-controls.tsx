"use client";

import { useActionState } from "react";

import {
  assignJobAction,
  changeProductionStatusAction,
  INITIAL_STAFF_JOB_ACTION_STATE,
  overrideQueueAction,
  reassignJobAction,
  reissuePickupAction,
  releaseJobAction,
  updatePackageCountAction,
} from "@/app/app/staff/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form-controls";

function Feedback({ state }: { state: typeof INITIAL_STAFF_JOB_ACTION_STATE }) {
  return state.message ? (
    <p
      className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-success"}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  ) : null;
}

function HiddenJob({ publicReference, version }: { publicReference: string; version: number }) {
  return (
    <>
      <input name="publicReference" type="hidden" value={publicReference} />
      <input name="version" type="hidden" value={version} />
    </>
  );
}

export interface OperationWorker {
  disabled: boolean;
  id: string;
  label: string;
}

export function ReleaseJobForm({ publicReference, version }: { publicReference: string; version: number }) {
  const [state, action, pending] = useActionState(releaseJobAction, INITIAL_STAFF_JOB_ACTION_STATE);
  return (
    <form action={action} className="space-y-3">
      <HiddenJob publicReference={publicReference} version={version} />
      <p className="text-sm leading-6 text-muted">This confirms operational approval. It does not start production or record payment.</p>
      <Button disabled={pending} type="submit">{pending ? "Releasing…" : "Release to production queue"}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function ClaimJobForm({ publicReference, version }: { publicReference: string; version: number }) {
  const [state, action, pending] = useActionState(assignJobAction, INITIAL_STAFF_JOB_ACTION_STATE);
  return (
    <form action={action} className="space-y-3">
      <HiddenJob publicReference={publicReference} version={version} />
      <Button disabled={pending} type="submit">{pending ? "Taking job…" : "Take this job"}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function AssignJobForm({ publicReference, version, workers }: { publicReference: string; version: number; workers: readonly OperationWorker[] }) {
  const [state, action, pending] = useActionState(assignJobAction, INITIAL_STAFF_JOB_ACTION_STATE);
  const hasAvailableWorker = workers.some((worker) => !worker.disabled);
  return (
    <form action={action} className="space-y-3">
      <HiddenJob publicReference={publicReference} version={version} />
      <label className="text-sm font-medium" htmlFor="assign-worker">Eligible worker</label>
      <Select id="assign-worker" name="workerMembershipId" required>
        <option value="">Choose a worker</option>
        {workers.map((worker) => <option disabled={worker.disabled} key={worker.id} value={worker.id}>{worker.label}</option>)}
      </Select>
      <Button disabled={pending || !hasAvailableWorker} type="submit">{pending ? "Assigning…" : "Assign worker"}</Button>
      {!hasAvailableWorker ? <p className="text-xs leading-5 text-muted">No active qualified worker currently has capacity for this job. Check Team settings or existing assignments.</p> : null}
      <Feedback state={state} />
    </form>
  );
}

export function ReassignJobForm({ publicReference, version, workers }: { publicReference: string; version: number; workers: readonly OperationWorker[] }) {
  const [state, action, pending] = useActionState(reassignJobAction, INITIAL_STAFF_JOB_ACTION_STATE);
  const hasAvailableWorker = workers.some((worker) => !worker.disabled);
  return (
    <details className="rounded-xl border bg-surface-muted p-4">
      <summary className="cursor-pointer font-semibold">Reassign worker</summary>
      <form action={action} className="mt-4 space-y-3">
        <HiddenJob publicReference={publicReference} version={version} />
        <label className="text-sm font-medium" htmlFor="reassign-worker">New worker</label>
        <Select id="reassign-worker" name="workerMembershipId" required>
          <option value="">Choose a worker</option>
          {workers.map((worker) => <option disabled={worker.disabled} key={worker.id} value={worker.id}>{worker.label}</option>)}
        </Select>
        <label className="text-sm font-medium" htmlFor="reassign-reason">Reason</label>
        <Textarea id="reassign-reason" maxLength={500} minLength={5} name="reason" required />
        <Button disabled={pending || !hasAvailableWorker} type="submit" variant="outline">{pending ? "Reassigning…" : "Record reassignment"}</Button>
        <Feedback state={state} />
      </form>
    </details>
  );
}

export function QueueOverrideForm({ publicReference, version }: { publicReference: string; version: number }) {
  const [state, action, pending] = useActionState(overrideQueueAction, INITIAL_STAFF_JOB_ACTION_STATE);
  return (
    <details className="rounded-xl border bg-surface-muted p-4">
      <summary className="cursor-pointer font-semibold">Queue exception</summary>
      <form action={action} className="mt-4 space-y-3">
        <HiddenJob publicReference={publicReference} version={version} />
        <label className="text-sm font-medium" htmlFor="queue-direction">Change</label>
        <Select id="queue-direction" name="direction" required>
          <option value="PROMOTE">Move ahead within this priority</option>
          <option value="DEMOTE">Move behind within this priority</option>
        </Select>
        <label className="text-sm font-medium" htmlFor="queue-reason">Why is this exception needed?</label>
        <Textarea id="queue-reason" maxLength={500} minLength={5} name="reason" required />
        <Button disabled={pending} type="submit" variant="outline">{pending ? "Saving…" : "Save queue exception"}</Button>
        <Feedback state={state} />
      </form>
    </details>
  );
}

export function ProductionStatusForm({ label, publicReference, toStatus, version }: { label: string; publicReference: string; toStatus: "PREPARING_FOR_PICKUP" | "PROCESSING" | "READY_FOR_PICKUP"; version: number }) {
  const [state, action, pending] = useActionState(changeProductionStatusAction, INITIAL_STAFF_JOB_ACTION_STATE);
  return (
    <form action={action} className="space-y-3">
      <HiddenJob publicReference={publicReference} version={version} />
      <input name="toStatus" type="hidden" value={toStatus} />
      <Button disabled={pending} type="submit">{pending ? "Updating…" : label}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function PackageCountForm({ packageCount, publicReference, version }: { packageCount: number; publicReference: string; version: number }) {
  const [state, action, pending] = useActionState(updatePackageCountAction, INITIAL_STAFF_JOB_ACTION_STATE);
  return (
    <form action={action} className="space-y-3">
      <HiddenJob publicReference={publicReference} version={version} />
      <label className="text-sm font-medium" htmlFor="package-count">Physical packages or pieces</label>
      <Input defaultValue={packageCount} id="package-count" max={100} min={1} name="packageCount" required type="number" />
      <p className="text-xs leading-5 text-muted">This is separate from the printed quantity. Use it for individually tracked bundles or pieces.</p>
      <Button disabled={pending} type="submit" variant="outline">{pending ? "Saving…" : "Save package count"}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function ReissuePickupForm({ publicReference }: { publicReference: string }) {
  const [state, action, pending] = useActionState(reissuePickupAction, INITIAL_STAFF_JOB_ACTION_STATE);
  return (
    <details className="rounded-xl border bg-surface-muted p-4">
      <summary className="cursor-pointer font-semibold">Replace pickup code</summary>
      <form action={action} className="mt-4 space-y-3">
        <input name="publicReference" type="hidden" value={publicReference} />
        <label className="text-sm font-medium" htmlFor="reissue-reason">Reason</label>
        <Textarea id="reissue-reason" maxLength={500} minLength={5} name="reason" required />
        <Button disabled={pending} type="submit" variant="outline">{pending ? "Replacing…" : "Revoke old code and issue new"}</Button>
        <Feedback state={state} />
      </form>
    </details>
  );
}
