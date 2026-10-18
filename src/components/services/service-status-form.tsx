"use client";

import { useActionState } from "react";

import { setServiceStatusAction } from "@/app/app/services/actions";
import { FormMessage } from "@/components/ui/form-controls";
import { INITIAL_SERVICE_ACTION_STATE } from "@/domain/service-forms";

import { ServiceSubmitButton } from "./submit-button";

export function ServiceStatusForm({
  active,
  serviceId,
  version,
}: {
  active: boolean;
  serviceId: string;
  version: number;
}) {
  const [state, action] = useActionState(
    setServiceStatusAction,
    INITIAL_SERVICE_ACTION_STATE,
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
              ? "Restore this service to the active public catalogue?"
              : "Deactivate this service? It will leave the public catalogue but its history will remain.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="active" type="hidden" value={String(nextActive)} />
      <input name="serviceId" type="hidden" value={serviceId} />
      <input name="version" type="hidden" value={version} />
      <ServiceSubmitButton
        pendingLabel={nextActive ? "Restoring…" : "Deactivating…"}
        variant="outline"
      >
        {nextActive ? "Restore service" : "Deactivate service"}
      </ServiceSubmitButton>
      <FormMessage message={state.message} status={state.status} />
    </form>
  );
}
