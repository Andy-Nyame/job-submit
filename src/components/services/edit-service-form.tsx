"use client";

import { useActionState } from "react";

import { updateServiceAction } from "@/app/app/services/actions";
import { FormMessage } from "@/components/ui/form-controls";
import { INITIAL_SERVICE_ACTION_STATE } from "@/domain/service-forms";

import {
  ServiceFormFields,
  type ServiceFormValues,
} from "./service-form-fields";
import { ServiceSubmitButton } from "./submit-button";

export function EditServiceForm({
  serviceId,
  values,
  version,
}: {
  serviceId: string;
  values: ServiceFormValues;
  version: number;
}) {
  const [state, action] = useActionState(
    updateServiceAction,
    INITIAL_SERVICE_ACTION_STATE,
  );

  return (
    <form action={action} className="space-y-6">
      <input name="serviceId" type="hidden" value={serviceId} />
      <input name="version" type="hidden" value={version} />
      <ServiceFormFields
        includeActiveState={false}
        prefix="edit-service"
        values={values}
      />
      <FormMessage message={state.message} status={state.status} />
      <ServiceSubmitButton pendingLabel="Saving service…">
        Save service settings
      </ServiceSubmitButton>
    </form>
  );
}
