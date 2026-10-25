"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  confirmPickupAction,
  inspectPickupAction,
  type PickupInspectionState,
} from "@/app/app/staff/pickup/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";
import { isJobSubmissionSnapshot } from "@/domain/job-submission";

const INITIAL_PICKUP_STATE: PickupInspectionState = {
  inspection: null,
  message: "",
  status: "idle",
};

function DetailList({ snapshot }: { snapshot: unknown }) {
  if (!isJobSubmissionSnapshot(snapshot)) {
    return <p className="text-sm text-muted">This older job has no structured saved submission. Match the physical work against the staff job detail before handover.</p>;
  }
  const request = snapshot.request;
  const size = request.size.kind === "NONE" ? null : request.size.kind === "PRESET" ? request.size.option : `${request.size.width} × ${request.size.height} ${request.size.unit.toLowerCase()}`;
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-muted">Requested item</dt><dd className="mt-1 font-medium">{request.title}</dd></div>
      <div><dt className="text-muted">Quantity</dt><dd className="mt-1 font-medium">{request.quantity?.toLocaleString("en-US") ?? "Not applicable"}</dd></div>
      {size ? <div><dt className="text-muted">Size</dt><dd className="mt-1 font-medium">{size}</dd></div> : null}
      {request.material ? <div><dt className="text-muted">Material</dt><dd className="mt-1 font-medium">{request.material}</dd></div> : null}
      {request.finishing ? <div><dt className="text-muted">Finishing</dt><dd className="mt-1 font-medium">{request.finishing}</dd></div> : null}
      {Object.entries(request.jobFields).map(([key, value]) => <div key={key}><dt className="text-muted">{key}</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{value}</dd></div>)}
      {request.variations.map((variation, index) => <div className="sm:col-span-2" key={variation.id}><dt className="text-muted">Variation {index + 1} · {variation.quantity.toLocaleString("en-US")}</dt><dd className="mt-1">{Object.entries(variation.fieldValues).map(([key, value]) => `${key}: ${value}`).join(" · ")}</dd></div>)}
      <div className="sm:col-span-2"><dt className="text-muted">Customer instructions</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{request.instructions || "No extra instructions."}</dd></div>
    </dl>
  );
}

const checks = [
  ["correctJob", "The job number matches the physical work"],
  ["correctSpecifications", "The service and saved specifications are correct"],
  ["packagesPresent", "All physical packages or pieces are present"],
  ["collectorVerified", "The customer or authorized collector was verified"],
] as const;

export function PickupVerificationPanel({ canOverride }: { canOverride: boolean }) {
  const inspectForm = useRef<HTMLFormElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const [inspectionState, inspectAction, inspecting] = useActionState(inspectPickupAction, INITIAL_PICKUP_STATE);
  const [confirmationState, confirmAction, confirming] = useActionState(confirmPickupAction, INITIAL_PICKUP_STATE);

  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    if (!fragment) return;
    if (codeInput.current) codeInput.current.value = fragment;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    window.requestAnimationFrame(() => inspectForm.current?.requestSubmit());
  }, []);

  const inspection = inspectionState.inspection;
  return (
    <div className="space-y-6">
      <form action={inspectAction} className="rounded-2xl border bg-surface p-5 sm:p-6" ref={inspectForm}>
        <label className="font-semibold" htmlFor="pickup-code">Scan or enter the customer&apos;s pickup code</label>
        <p className="mt-2 text-sm leading-6 text-muted">The private code is different from the visible job number. Scanning checks the code but never completes pickup automatically.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input autoComplete="off" id="pickup-code" name="code" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" ref={codeInput} required />
          <Button disabled={inspecting} type="submit">{inspecting ? "Checking…" : "Check code"}</Button>
        </div>
        {inspectionState.message ? <p className={`mt-3 text-sm ${inspectionState.status === "error" ? "text-destructive" : "text-success"}`} role={inspectionState.status === "error" ? "alert" : "status"}>{inspectionState.message}</p> : null}
      </form>

      {inspection ? (
        <section className="rounded-2xl border border-primary/35 bg-surface p-5 sm:p-7" aria-labelledby="verified-job-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Verified job</p><h2 className="mt-2 font-mono text-2xl font-black" id="verified-job-heading">{inspection.job.publicReference}</h2></div>
            <span className="rounded-full border border-success/45 bg-success/10 px-3 py-1 text-xs font-semibold text-success">Ready for pickup</span>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">Service</dt><dd className="mt-1 font-semibold">{inspection.job.service.name}</dd></div>
            <div><dt className="text-muted">Priority</dt><dd className="mt-1 font-semibold">{inspection.job.priority === "EXPRESS" ? "Express / Urgent" : "Regular"}</dd></div>
            <div><dt className="text-muted">Physical packages</dt><dd className="mt-1 font-semibold">{inspection.job.packageCount}</dd></div>
          </dl>
          <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Saved customer requirements</h3><div className="mt-4"><DetailList snapshot={inspection.job.submissionSnapshot} /></div></div>
          <form action={confirmAction} className="mt-6 border-t pt-5">
            <input name="code" type="hidden" value={inspection.code} />
            <fieldset><legend className="font-semibold">Check before handover</legend><div className="mt-4 space-y-3">{checks.map(([name, label]) => <label className="flex min-h-11 items-start gap-3 rounded-lg border bg-surface-muted p-3 text-sm" key={name}><input className="mt-0.5 size-5 accent-primary" name={name} required type="checkbox" /><span>{label}</span></label>)}</div></fieldset>
            <Button className="mt-5" disabled={confirming} type="submit">{confirming ? "Confirming…" : "Confirm Pickup"}</Button>
          </form>
        </section>
      ) : null}

      {confirmationState.message ? <p className={`rounded-xl border p-4 text-sm ${confirmationState.status === "error" ? "border-destructive/45 bg-destructive-surface text-destructive" : "border-success/45 bg-success/10 text-success"}`} role={confirmationState.status === "error" ? "alert" : "status"}>{confirmationState.message}</p> : null}

      {canOverride ? (
        <details className="rounded-2xl border bg-surface p-5">
          <summary className="cursor-pointer font-semibold">Management manual verification</summary>
          <p className="mt-3 text-sm leading-6 text-muted">Use only when the customer cannot present the active code. Every check and the reason are permanently audited.</p>
          <form action={confirmAction} className="mt-4 space-y-4">
            <label className="text-sm font-medium" htmlFor="override-reference">Job number</label><Input id="override-reference" name="publicReference" required />
            <label className="text-sm font-medium" htmlFor="override-reason">Reason and evidence checked</label><Textarea id="override-reason" maxLength={500} minLength={5} name="overrideReason" required />
            <fieldset><legend className="text-sm font-medium">Handover checks</legend><div className="mt-3 space-y-3">{checks.map(([name, label]) => <label className="flex items-start gap-3 text-sm" key={name}><input className="mt-0.5 size-5 accent-primary" name={name} required type="checkbox" /><span>{label}</span></label>)}</div></fieldset>
            <Button disabled={confirming} type="submit" variant="outline">Confirm with recorded override</Button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
