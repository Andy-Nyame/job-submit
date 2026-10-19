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
          additionalStepPrice: "",
          artworkRequirement: "",
          customDimensionUnits: [],
          customFields: [],
          customInstructions: "",
          defaultComplexity: null,
          description: "",
          finishingOptions: "",
          finishingRequired: false,
          fixedPriceCoverage: "",
          fixedSizeHeight: "",
          fixedSizeUnit: "",
          fixedSizeWidth: "",
          isActive: true,
          materialOptions: "",
          materialsRequired: false,
          name: "",
          onlineSubmissionEnabled: false,
          pricingMode: "ON_REQUEST",
          quantityIncrement: "",
          quantityMaximum: "",
          quantityMinimum: "",
          quantityPresets: "",
          quantityUnit: "",
          sizeMode: "NO_SIZE",
          standardSizeOptions: "",
          startingPrice: "",
          startingQuantity: "",
          variationsEnabled: false,
        }}
      />
      <p className="rounded-md border border-accent/35 bg-accent/10 p-3 text-xs leading-5 text-muted">
        Price on request never creates an automatic total. Fixed pricing applies
        only when the saved quantity and specification rules are satisfied.
      </p>
      <FormMessage message={state.message} status={state.status} />
      <ServiceSubmitButton pendingLabel="Creating service…">
        Create service
      </ServiceSubmitButton>
    </form>
  );
}
