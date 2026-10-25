"use server";

import { revalidatePath } from "next/cache";

import { requireStaffJobAccess } from "@/server/staff-jobs/authorization";
import { StaffJobOperationError } from "@/server/staff-jobs/errors";
import {
  confirmJobPickup,
  inspectPickupCredential,
} from "@/server/job-operations/management";

export interface PickupInspectionState {
  inspection: Awaited<ReturnType<typeof inspectPickupCredential>>;
  message: string;
  status: "error" | "idle" | "success";
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function pickupError(error: unknown): PickupInspectionState {
  if (error instanceof StaffJobOperationError) {
    const message = error.code === "CREDENTIAL_INVALID"
      ? "That pickup code is invalid, expired, or already used. Check the code or ask management to replace it."
      : error.code === "MANAGEMENT_REQUIRED"
        ? "Only an Owner or Admin can use the manual override."
        : error.code === "BUSINESS_UNAVAILABLE"
          ? "Pickup access is unavailable while this account or business is inactive."
          : "Pickup could not be confirmed safely. Check every item and try again.";
    return { inspection: null, message, status: "error" };
  }
  return {
    inspection: null,
    message: "Pickup verification is temporarily unavailable. Nothing was marked collected.",
    status: "error",
  };
}

export async function inspectPickupAction(
  _state: PickupInspectionState,
  formData: FormData,
): Promise<PickupInspectionState> {
  try {
    const actor = await requireStaffJobAccess();
    const inspection = await inspectPickupCredential(actor, text(formData, "code"));
    if (!inspection) {
      return {
        inspection: null,
        message: "That pickup code is invalid, expired, or already used.",
        status: "error",
      };
    }
    return { inspection, message: "Code verified. Check the physical work before handover.", status: "success" };
  } catch (error) {
    return pickupError(error);
  }
}

export async function confirmPickupAction(
  _state: PickupInspectionState,
  formData: FormData,
): Promise<PickupInspectionState> {
  try {
    const actor = await requireStaffJobAccess();
    const result = await confirmJobPickup(actor, {
      checklist: {
        collectorVerified: checked(formData, "collectorVerified"),
        correctJob: checked(formData, "correctJob"),
        correctSpecifications: checked(formData, "correctSpecifications"),
        packagesPresent: checked(formData, "packagesPresent"),
      },
      code: text(formData, "code") || undefined,
      overrideReason: text(formData, "overrideReason") || undefined,
      publicReference: text(formData, "publicReference") || undefined,
    });
    revalidatePath("/app/staff/jobs");
    revalidatePath(`/app/staff/jobs/${result.publicReference}`);
    revalidatePath("/app/jobs");
    revalidatePath(`/app/jobs/${result.publicReference}`);
    revalidatePath("/app/notifications");
    return {
      inspection: null,
      message: `${result.publicReference} was securely marked as collected.`,
      status: "success",
    };
  } catch (error) {
    return pickupError(error);
  }
}
