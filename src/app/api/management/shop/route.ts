import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  ApplicationAccessDeniedError,
  AuthenticationRequiredError,
  RoleRequiredError,
} from "@/server/auth/errors";
import { isSameOriginMutation } from "@/server/http/same-origin";
import { requireServiceManager } from "@/server/services/authorization";
import { ShopOperationError } from "@/server/shop/errors";
import { setShopOpenState } from "@/server/shop/management";

export async function POST(request: Request) {
  try {
    if (!isSameOriginMutation(request)) {
      return NextResponse.json({ message: "That request could not be verified." }, { status: 403 });
    }
    const input: unknown = await request.json();
    if (
      typeof input !== "object" || input === null ||
      !("acceptingNewJobs" in input) || typeof input.acceptingNewJobs !== "boolean" ||
      !("expectedState" in input) || typeof input.expectedState !== "boolean" ||
      input.acceptingNewJobs === input.expectedState
    ) {
      return NextResponse.json({ message: "Refresh and try that change again." }, { status: 400 });
    }
    const actor = await requireServiceManager();
    const result = await setShopOpenState(actor, {
      acceptingNewJobs: input.acceptingNewJobs as boolean,
      expectedState: input.expectedState as boolean,
    });
    revalidatePath("/app/jobs/new");
    revalidatePath("/app/staff/jobs");
    revalidatePath("/app/services");
    return NextResponse.json({ acceptingNewJobs: result.acceptingNewJobs, message: result.acceptingNewJobs ? "The shop is open for enabled online services." : "The shop is closed to new customer jobs." });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ message: "Sign in again before changing the shop status." }, { status: 401 });
    }
    if (error instanceof ApplicationAccessDeniedError || error instanceof RoleRequiredError) {
      return NextResponse.json({ message: "You do not have permission to change the shop status." }, { status: 403 });
    }
    if (error instanceof ShopOperationError) {
      return NextResponse.json({ message: error.code === "STALE_UPDATE" ? "The shop status changed in another session. Refresh and try again." : "The shop is unavailable for this account." }, { status: error.code === "STALE_UPDATE" ? 409 : 403 });
    }
    console.error("Shop status request failed before completion.", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ message: "The shop status could not be saved. Nothing was changed." }, { status: 500 });
  }
}
