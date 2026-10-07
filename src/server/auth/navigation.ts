import "server-only";

import { redirect } from "next/navigation";

import { getApplicationPrincipal } from "./authorization";

export async function redirectAuthenticatedUser() {
  const principal = await getApplicationPrincipal();

  if (!principal) {
    return;
  }

  redirect(principal.access.allowed ? "/app" : "/access-denied");
}
