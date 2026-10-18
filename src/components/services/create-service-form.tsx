"use client";

import { useActionState } from "react";

import { createServiceAction } from "@/app/app/services/actions";
import { FormMessage } from "@/components/ui/form-controls";
import { INITIAL_SERVICE_ACTION_STATE } from "@/domain/service-forms";

import { ServiceFormFields } from "./service-form-fields";
import { ServiceSubmitButton } from "./submit-button";

export function CreateServiceForm() {
  const [state, action] = useActionState(
    createServiceAction,
    INITIAL_SERVICE_ACTION_STATE,
  );

  return (
    <form action={action} className="space-y-6">
      <ServiceFormFields
        includeActiveState
        prefix="create-service"
        values={{
          defaultComplexity: null,
          defaultWorkloadClass: null,
          description: "",
          isActive: true,
          name: "",
          onlineSubmissionEnabled: false,
          proofRequiredByDefault: null,
          sortOrder: 0,
        }}
      />
      <p className="rounded-md border border-accent/35 bg-accent/10 p-3 text-xs leading-5 text-muted">
        Services never set customer prices. Each future job will be costed
        individually by an authorized person.
      </p>
      <FormMessage message={state.message} status={state.status} />
      <ServiceSubmitButton pendingLabel="Creating service…">
        Create service
      </ServiceSubmitButton>
    </form>
  );
}
