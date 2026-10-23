"use server";

import { revalidatePath } from "next/cache";

import { requireStaffJobAccess } from "@/server/staff-jobs/authorization";
import { StaffJobOperationError } from "@/server/staff-jobs/errors";
import {
  addInternalJobNote,
  startStaffJobReview,
} from "@/server/staff-jobs/management";

export interface StaffJobActionState {
  message: string;
  status: "error" | "idle" | "success";
}

export const INITIAL_STAFF_JOB_ACTION_STATE: StaffJobActionState = {
  message: "",
  status: "idle",
};

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function actionError(error: unknown): StaffJobActionState {
  if (error instanceof StaffJobOperationError) {
    const messages: Record<StaffJobOperationError["code"], string> = {
      BUSINESS_UNAVAILABLE:
        "Staff job access is unavailable while the account or business is inactive.",
      INVALID_INPUT: "Check the submitted information and try again.",
      INVALID_TRANSITION:
        "Only a newly submitted job can be moved into staff review.",
      NOT_FOUND: "The requested job was not found in this business.",
      STALE_UPDATE:
        "This job changed in another session. Refresh before trying again.",
    };
    return { message: messages[error.code], status: "error" };
  }
  return {
    message: "The job could not be updated safely. Please try again.",
    status: "error",
  };
}

function revalidateJobPages(publicReference: string) {
  revalidatePath("/app/staff/jobs");
  revalidatePath(`/app/staff/jobs/${publicReference}`);
  revalidatePath("/app/jobs");
  revalidatePath(`/app/jobs/${publicReference}`);
}

export async function startJobReviewAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  const expectedVersion = Number(readText(formData, "version"));
  try {
    const actor = await requireStaffJobAccess();
    await startStaffJobReview(actor, { expectedVersion, publicReference });
    revalidateJobPages(publicReference);
    return { message: "Staff review started.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}

export async function addInternalNoteAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    await addInternalJobNote(actor, {
      body: readText(formData, "body"),
      publicReference,
    });
    revalidateJobPages(publicReference);
    return { message: "Internal note added.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}
