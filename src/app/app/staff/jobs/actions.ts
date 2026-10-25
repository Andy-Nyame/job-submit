"use server";

import { revalidatePath } from "next/cache";

import { requireStaffJobAccess } from "@/server/staff-jobs/authorization";
import { StaffJobOperationError } from "@/server/staff-jobs/errors";
import {
  addInternalJobNote,
  startStaffJobReview,
} from "@/server/staff-jobs/management";
import {
  assignProductionJob,
  clearDesignDependency,
  changeProductionStatus,
  overrideQueueOrder,
  reassignProductionJob,
  reissuePickupCredential,
  releaseJobForProduction,
  updatePhysicalPackageCount,
} from "@/server/job-operations/management";

export interface StaffJobActionState {
  message: string;
  status: "error" | "idle" | "success";
}

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function actionError(error: unknown): StaffJobActionState {
  if (error instanceof StaffJobOperationError) {
    const messages: Record<StaffJobOperationError["code"], string> = {
      ASSIGNMENT_CONFLICT:
        "Another worker took or changed this job first. The page will refresh with the latest assignment.",
      BUSINESS_UNAVAILABLE:
        "Staff job access is unavailable while the account or business is inactive.",
      CAPACITY_UNAVAILABLE:
        "This worker has reached the configured workload limit for this type of job.",
      CREDENTIAL_INVALID:
        "That pickup code is invalid, expired, or already used.",
      CREDENTIAL_UNAVAILABLE:
        "A pickup credential is not available for this job.",
      DEPENDENCY_PENDING:
        "This printing job is waiting for its linked design to be completed and approved.",
      INVALID_INPUT: "Check the submitted information and try again.",
      INVALID_TRANSITION:
        "That action is not available at the job's current stage.",
      MANAGEMENT_REQUIRED:
        "Only an Owner or Admin can perform that management action.",
      NOT_FOUND: "The requested job was not found in this business.",
      PRICING_NOT_CONFIRMED:
        "Confirm the fixed price or obtain customer acceptance of a quotation before release.",
      STALE_UPDATE:
        "This job changed in another session. Refresh before trying again.",
      WORKER_NOT_ELIGIBLE:
        "The selected worker is inactive or is not qualified for this service.",
    };
    return { message: messages[error.code], status: "error" };
  }
  return {
    message: "The job could not be updated safely. Please try again.",
    status: "error",
  };
}

export async function releaseJobAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    await releaseJobForProduction(actor, {
      expectedVersion: Number(readText(formData, "version")),
      publicReference,
    });
    revalidateJobPages(publicReference);
    return { message: "Job released and ready for an eligible worker.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}

export async function clearDesignDependencyAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    await clearDesignDependency(actor, {
      expectedVersion: Number(readText(formData, "version")),
      publicReference,
      reason: readText(formData, "reason"),
    });
    revalidateJobPages(publicReference);
    return { message: "Design dependency cleared. The printing job can now follow the normal release checks.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}

export async function assignJobAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    await assignProductionJob(actor, {
      expectedVersion: Number(readText(formData, "version")),
      publicReference,
      workerMembershipId: readText(formData, "workerMembershipId") || undefined,
    });
    revalidateJobPages(publicReference);
    revalidatePath("/app/notifications");
    return { message: actor.role === "WORKER" ? "This job is now assigned to you." : "Worker assigned.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}

export async function reassignJobAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    await reassignProductionJob(actor, {
      expectedVersion: Number(readText(formData, "version")),
      publicReference,
      reason: readText(formData, "reason"),
      workerMembershipId: readText(formData, "workerMembershipId"),
    });
    revalidateJobPages(publicReference);
    return { message: "Worker reassigned and the reason was recorded.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}

export async function overrideQueueAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    const direction = readText(formData, "direction");
    if (direction !== "PROMOTE" && direction !== "DEMOTE") throw new StaffJobOperationError("INVALID_INPUT");
    await overrideQueueOrder(actor, {
      direction,
      expectedVersion: Number(readText(formData, "version")),
      publicReference,
      reason: readText(formData, "reason"),
    });
    revalidateJobPages(publicReference);
    return { message: "Queue exception recorded.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePackageCountAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    await updatePhysicalPackageCount(actor, {
      expectedVersion: Number(readText(formData, "version")),
      packageCount: Number(readText(formData, "packageCount")),
      publicReference,
    });
    revalidateJobPages(publicReference);
    return { message: "Physical package count saved.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}

export async function changeProductionStatusAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    const toStatus = readText(formData, "toStatus");
    if (!["PROCESSING", "PREPARING_FOR_PICKUP", "READY_FOR_PICKUP"].includes(toStatus)) {
      throw new StaffJobOperationError("INVALID_INPUT");
    }
    await changeProductionStatus(actor, {
      expectedVersion: Number(readText(formData, "version")),
      publicReference,
      toStatus: toStatus as "PREPARING_FOR_PICKUP" | "PROCESSING" | "READY_FOR_PICKUP",
    });
    revalidateJobPages(publicReference);
    revalidatePath("/app/notifications");
    return { message: toStatus === "READY_FOR_PICKUP" ? "Job is ready. A private pickup code was issued." : "Production progress updated.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
}

export async function reissuePickupAction(
  _state: StaffJobActionState,
  formData: FormData,
): Promise<StaffJobActionState> {
  const publicReference = readText(formData, "publicReference");
  try {
    const actor = await requireStaffJobAccess();
    await reissuePickupCredential(actor, {
      publicReference,
      reason: readText(formData, "reason"),
    });
    revalidateJobPages(publicReference);
    return { message: "The old pickup code was revoked and a new code was issued.", status: "success" };
  } catch (error) {
    return actionError(error);
  }
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
