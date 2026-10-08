"use server";

import { revalidatePath } from "next/cache";

import type { TeamActionState } from "@/domain/team-forms";
import { requireTeamManager } from "@/server/team/authorization";
import { TeamOperationError } from "@/server/team/errors";
import {
  createWorkerInvitation,
  reissueWorkerInvitation,
  revokeWorkerInvitation,
} from "@/server/team/invitations";
import {
  setWorkerActiveState,
  updateWorkerSettings,
} from "@/server/team/workers";

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readPositiveInteger(formData: FormData, name: string) {
  const value = Number(readText(formData, name));
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

function readNonnegativeInteger(formData: FormData, name: string) {
  const value = Number(readText(formData, name));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function errorState(error: unknown): TeamActionState {
  if (error instanceof TeamOperationError) {
    const messages: Record<TeamOperationError["code"], string> = {
      ALREADY_WORKER: "That account is already a worker.",
      BLOCKED_ACCOUNT:
        "This worker cannot be activated while another account restriction applies.",
      DUPLICATE_INVITATION:
        "A pending invitation already exists for that email.",
      INVITATION_UNAVAILABLE:
        "This invitation is no longer available. Refresh and try again.",
      NOT_FOUND: "The requested worker record was not found.",
      PRIVILEGED_MEMBERSHIP_PROTECTED:
        "Privileged ADMIN and OWNER memberships cannot be changed through worker invitations.",
      STALE_UPDATE:
        "This record changed in another session. Refresh before trying again.",
      VALIDATION: "Check the supplied values and try again.",
    };
    return { message: messages[error.code], status: "error" };
  }

  return {
    message: "The team change could not be completed safely. Please try again.",
    status: "error",
  };
}

export async function inviteWorkerAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const actor = await requireTeamManager();
    const result = await createWorkerInvitation(
      actor,
      readText(formData, "email"),
    );
    revalidatePath("/app/team");
    return {
      invitationPath: result.invitationPath,
      message:
        "Invitation created. Copy the link now; the secret is not stored and cannot be shown again.",
      status: "success",
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function manageInvitationAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const actor = await requireTeamManager();
    const invitationId = readText(formData, "invitationId");
    const intent = readText(formData, "intent");
    if (!invitationId) {
      return { message: "Invalid invitation.", status: "error" };
    }

    if (intent === "reissue") {
      const result = await reissueWorkerInvitation(actor, invitationId);
      revalidatePath("/app/team");
      return {
        invitationPath: result.invitationPath,
        message:
          "A replacement invitation was created. The previous link is no longer valid.",
        status: "success",
      };
    }

    if (intent === "revoke") {
      const version = readPositiveInteger(formData, "version");
      if (!version) {
        return { message: "Invalid invitation version.", status: "error" };
      }
      await revokeWorkerInvitation(actor, { invitationId, version });
      revalidatePath("/app/team");
      return { message: "Invitation revoked.", status: "success" };
    }

    return { message: "Unsupported invitation action.", status: "error" };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateWorkerAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const actor = await requireTeamManager();
    const expectedProfileVersion = readPositiveInteger(
      formData,
      "profileVersion",
    );
    const maxQuickWorkload = readNonnegativeInteger(
      formData,
      "maxQuickWorkload",
    );
    const maxStandardWorkload = readNonnegativeInteger(
      formData,
      "maxStandardWorkload",
    );
    if (
      !expectedProfileVersion ||
      maxQuickWorkload === null ||
      maxStandardWorkload === null
    ) {
      return { message: "Check the workload values.", status: "error" };
    }

    await updateWorkerSettings(actor, {
      canTakeFocus: formData.get("canTakeFocus") === "on",
      displayName: readText(formData, "displayName"),
      expectedProfileVersion,
      maxQuickWorkload,
      maxStandardWorkload,
      membershipId: readText(formData, "membershipId"),
      serviceIds: formData
        .getAll("serviceIds")
        .filter((value): value is string => typeof value === "string"),
    });
    revalidatePath("/app/team");
    revalidatePath(`/app/team/workers/${readText(formData, "membershipId")}`);
    return { message: "Worker settings updated.", status: "success" };
  } catch (error) {
    return errorState(error);
  }
}

export async function setWorkerStatusAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const actor = await requireTeamManager();
    const expectedMembershipVersion = readPositiveInteger(
      formData,
      "membershipVersion",
    );
    const expectedProfileVersion = readPositiveInteger(
      formData,
      "profileVersion",
    );
    if (!expectedMembershipVersion || !expectedProfileVersion) {
      return { message: "Invalid worker version.", status: "error" };
    }

    const membershipId = readText(formData, "membershipId");
    await setWorkerActiveState(actor, {
      active: readText(formData, "active") === "true",
      expectedMembershipVersion,
      expectedProfileVersion,
      membershipId,
    });
    revalidatePath("/app/team");
    revalidatePath(`/app/team/workers/${membershipId}`);
    return {
      message:
        readText(formData, "active") === "true"
          ? "Worker activated."
          : "Worker deactivated.",
      status: "success",
    };
  } catch (error) {
    return errorState(error);
  }
}
