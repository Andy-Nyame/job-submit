"use server";

import type { TeamActionState } from "@/domain/team-forms";
import { getAuthenticatedIdentity } from "@/server/auth/identity";
import { resolveApplicationPrincipal } from "@/server/auth/provisioning";
import { redeemWorkerInvitation } from "@/server/team/invitations";

export async function redeemWorkerInvitationAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const token = formData.get("token");
  if (typeof token !== "string") {
    return { message: "This invitation link is invalid.", status: "error" };
  }

  try {
    const identity = await getAuthenticatedIdentity();
    if (!identity) {
      return { message: "Sign in before accepting this invitation.", status: "error" };
    }
    const principal = await resolveApplicationPrincipal(identity);
    await redeemWorkerInvitation({ identity, principal, token });
    return {
      message: "Invitation accepted. Your worker profile is ready.",
      status: "success",
    };
  } catch {
    return {
      message:
        "This invitation cannot be accepted. It may be expired, already used, revoked, or intended for a different verified email.",
      status: "error",
    };
  }
}
