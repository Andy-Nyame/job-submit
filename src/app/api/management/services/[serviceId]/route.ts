import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { type ServiceConfigurationProfile } from "@/domain/service-blueprints";
import {
  ApplicationAccessDeniedError,
  AuthenticationRequiredError,
  RoleRequiredError,
} from "@/server/auth/errors";
import { isSameOriginMutation } from "@/server/http/same-origin";
import { requireServiceManager } from "@/server/services/authorization";
import { ServiceOperationError } from "@/server/services/errors";
import { updateServiceFromProfile } from "@/server/services/service-management";

function isProfile(value: unknown): value is ServiceConfigurationProfile {
  return typeof value === "string" && ["BANNER_PRINTING", "CONTAINER_NUMBER", "FOR_SALE_STICKERS", "LABEL_PRINTING", "ON_REQUEST", "POSTER_PRINTING", "STICKER_PRINTING"].includes(value);
}

export async function POST(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  try {
    if (!isSameOriginMutation(request)) {
      return NextResponse.json({ field: "form", message: "That request could not be verified." }, { status: 403 });
    }
    const [{ serviceId }, input]: [{ serviceId: string }, unknown] = await Promise.all([context.params, request.json()]);
    if (
      typeof input !== "object" || input === null ||
      !("name" in input) || typeof input.name !== "string" ||
      !("description" in input) || typeof input.description !== "string" ||
      !("configurationProfile" in input) || !isProfile(input.configurationProfile) ||
      !("onlineSubmissionEnabled" in input) || typeof input.onlineSubmissionEnabled !== "boolean" ||
      !("allowPriceNegotiation" in input) || typeof input.allowPriceNegotiation !== "boolean" ||
      !("expectedVersion" in input) || !Number.isSafeInteger(input.expectedVersion) ||
      !serviceId
    ) {
      return NextResponse.json({ field: "form", message: "Check the service details and try again." }, { status: 400 });
    }
    const actor = await requireServiceManager();
    const service = await updateServiceFromProfile(actor, {
      allowPriceNegotiation: input.allowPriceNegotiation as boolean,
      configurationProfile: input.configurationProfile as ServiceConfigurationProfile,
      description: input.description as string,
      expectedVersion: input.expectedVersion as number,
      name: input.name as string,
      onlineSubmissionEnabled: input.onlineSubmissionEnabled as boolean,
      serviceId,
    });
    revalidatePath("/");
    revalidatePath("/app/jobs/new");
    revalidatePath("/app/services");
    revalidatePath(`/app/services/${serviceId}`);
    return NextResponse.json({ message: "Service settings updated.", version: service.version });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ field: "form", message: "Sign in again before saving this service." }, { status: 401 });
    }
    if (error instanceof ApplicationAccessDeniedError || error instanceof RoleRequiredError) {
      return NextResponse.json({ field: "form", message: "You do not have permission to manage this service." }, { status: 403 });
    }
    if (error instanceof ServiceOperationError) {
      const messages: Record<ServiceOperationError["code"], { field: string; message: string; status: number }> = {
        BUSINESS_UNAVAILABLE: { field: "form", message: "Service management is unavailable while the business is inactive.", status: 403 },
        DUPLICATE_SERVICE: { field: "name", message: "Another service already uses that name.", status: 409 },
        INVALID_PRICING_CONFIGURATION: { field: "configurationProfile", message: "Choose an approved pricing setup for this service.", status: 400 },
        INVALID_QUANTITY_CONFIGURATION: { field: "configurationProfile", message: "The approved quantity rules are invalid.", status: 400 },
        INVALID_SPECIFICATION_CONFIGURATION: { field: "configurationProfile", message: "The approved customer requirements are invalid.", status: 400 },
        NOT_FOUND: { field: "form", message: "This service was not found.", status: 404 },
        STALE_UPDATE: { field: "form", message: "This service changed in another session. Refresh before saving again.", status: 409 },
        VALIDATION: { field: "form", message: "Check the service name and description.", status: 400 },
      };
      const response = messages[error.code];
      return NextResponse.json({ field: response.field, message: response.message }, { status: response.status });
    }
    console.error("Service settings request failed before completion.", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ field: "form", message: "The service could not be saved. Your entered information is still here." }, { status: 500 });
  }
}
