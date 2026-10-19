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
          artworkRequirement: "",
          customDimensionsEnabled: false,
          customDimensionsRequired: false,
          customInstructions: "",
          defaultComplexity: null,
          defaultWorkloadClass: null,
          description: "",
          dimensionUnits: [],
          finishingOptions: "",
          finishingRequired: false,
          indicativePriceDescription: "",
          indicativePriceMaximum: "",
          indicativePriceMinimum: "",
          isActive: true,
          materialOptions: "",
          materialsRequired: false,
          name: "",
          onlineSubmissionEnabled: false,
          proofRequiredByDefault: null,
          quantityIncrement: "",
          quantityMaximum: "",
          quantityMinimum: "",
          quantityPresets: "",
          quantityUnit: "",
          sizeOptions: "",
          sizesRequired: false,
        }}
      />
      <p className="rounded-md border border-accent/35 bg-accent/10 p-3 text-xs leading-5 text-muted">
        Any price range is informational only. Each future job will still be
        reviewed and costed individually by an authorized person.
      </p>
      <FormMessage message={state.message} status={state.status} />
      <ServiceSubmitButton pendingLabel="Creating service…">
        Create service
      </ServiceSubmitButton>
    </form>
  );
}
