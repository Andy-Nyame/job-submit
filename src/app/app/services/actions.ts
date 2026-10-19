"use server";

import { revalidatePath } from "next/cache";

import type { ServiceActionState } from "@/domain/service-forms";
import type {
  ServiceComplexityDefault,
  ServiceSettingsInput,
  ServiceWorkloadDefault,
} from "@/domain/service-policy";
import { requireServiceManager } from "@/server/services/authorization";
import { ServiceOperationError } from "@/server/services/errors";
import {
  createService,
  setServiceActiveState,
  updateService,
} from "@/server/services/service-management";

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readPositiveInteger(formData: FormData, name: string) {
  const value = Number(readText(formData, name));
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

function readTextList(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
}

function readComplexity(formData: FormData) {
  const value = readText(formData, "defaultComplexity");
  return (value || null) as ServiceComplexityDefault | null;
}

function readWorkload(formData: FormData) {
  const value = readText(formData, "defaultWorkloadClass");
  return (value || null) as ServiceWorkloadDefault | null;
}

function readProofDefault(formData: FormData) {
  const value = readText(formData, "proofRequiredByDefault");
  if (value === "required") {
    return { valid: true, value: true } as const;
  }
  if (value === "not-required") {
    return { valid: true, value: false } as const;
  }
  if (value === "") {
    return { valid: true, value: null } as const;
  }
  return { valid: false, value: null } as const;
}

function readServiceSettings(formData: FormData): ServiceSettingsInput | null {
  const proofDefault = readProofDefault(formData);
  if (!proofDefault.valid) {
    return null;
  }

  return {
    defaultComplexity: readComplexity(formData),
    defaultWorkloadClass: readWorkload(formData),
    description: readText(formData, "description"),
    isActive: formData.get("isActive") === "on",
    name: readText(formData, "name"),
    onlineSubmissionEnabled:
      formData.get("onlineSubmissionEnabled") === "on",
    price: {
      description: readText(formData, "indicativePriceDescription"),
      maximum: readText(formData, "indicativePriceMaximum"),
      minimum: readText(formData, "indicativePriceMinimum"),
    },
    proofRequiredByDefault: proofDefault.value,
    quantity: {
      increment: readText(formData, "quantityIncrement"),
      maximum: readText(formData, "quantityMaximum"),
      minimum: readText(formData, "quantityMinimum"),
      presets: readText(formData, "quantityPresets"),
      unit: readText(formData, "quantityUnit"),
    },
    specification: {
      artworkRequirement: readText(formData, "artworkRequirement"),
      customDimensionsEnabled:
        formData.get("customDimensionsEnabled") === "on",
      customDimensionsRequired:
        formData.get("customDimensionsRequired") === "on",
      customInstructions: readText(formData, "customInstructions"),
      dimensionUnits: readTextList(formData, "dimensionUnits"),
      finishingOptions: readText(formData, "finishingOptions"),
      finishingRequired: formData.get("finishingRequired") === "on",
      materialOptions: readText(formData, "materialOptions"),
      materialsRequired: formData.get("materialsRequired") === "on",
      sizeOptions: readText(formData, "sizeOptions"),
      sizesRequired: formData.get("sizesRequired") === "on",
    },
  };
}

function errorState(error: unknown): ServiceActionState {
  if (error instanceof ServiceOperationError) {
    const messages: Record<ServiceOperationError["code"], string> = {
      BUSINESS_UNAVAILABLE:
        "Service management is unavailable while the business is inactive.",
      DUPLICATE_SERVICE:
        "A service with the same normalized name already exists.",
      INVALID_PRICE_GUIDANCE:
        "Enter both estimate amounts, use no more than two decimal places, and keep the minimum at or below the maximum.",
      INVALID_QUANTITY_CONFIGURATION:
        "Check the quantity unit, limits, increment, and ascending presets. Every preset must satisfy the configured rules.",
      INVALID_SPECIFICATION_CONFIGURATION:
        "Check specification options, required choices, artwork settings, and custom-dimension units.",
      NOT_FOUND: "The requested service was not found.",
      STALE_UPDATE:
        "This service changed in another session. Refresh before trying again.",
      VALIDATION: "Check the service details and try again.",
    };
    return { message: messages[error.code], status: "error" };
  }

  return {
    message: "The service change could not be completed safely. Please try again.",
    status: "error",
  };
}

function revalidateServicePages(serviceId?: string) {
  revalidatePath("/");
  revalidatePath("/app/services");
  if (serviceId) {
    revalidatePath(`/app/services/${serviceId}`);
  }
}

export async function createServiceAction(
  _state: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  try {
    const actor = await requireServiceManager();
    const settings = readServiceSettings(formData);
    if (!settings) {
      return { message: "Check the service configuration.", status: "error" };
    }

    const service = await createService(actor, settings);
    revalidateServicePages(service.id);
    return { message: "Service created.", status: "success" };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateServiceAction(
  _state: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  try {
    const actor = await requireServiceManager();
    const expectedVersion = readPositiveInteger(formData, "version");
    const serviceId = readText(formData, "serviceId");
    const settings = readServiceSettings(formData);
    if (!expectedVersion || !serviceId || !settings) {
      return { message: "Check the service details.", status: "error" };
    }

    await updateService(actor, { ...settings, expectedVersion, serviceId });
    revalidateServicePages(serviceId);
    return { message: "Service settings updated.", status: "success" };
  } catch (error) {
    return errorState(error);
  }
}

export async function setServiceStatusAction(
  _state: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  try {
    const actor = await requireServiceManager();
    const expectedVersion = readPositiveInteger(formData, "version");
    const serviceId = readText(formData, "serviceId");
    const active = readText(formData, "active") === "true";
    if (!expectedVersion || !serviceId) {
      return { message: "Invalid service version.", status: "error" };
    }

    await setServiceActiveState(actor, {
      active,
      expectedVersion,
      serviceId,
    });
    revalidateServicePages(serviceId);
    return {
      message: active ? "Service restored." : "Service deactivated.",
      status: "success",
    };
  } catch (error) {
    return errorState(error);
  }
}
