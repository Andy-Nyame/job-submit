import { redirect } from "next/navigation";

import { defaultApplicationRoute } from "@/domain/shop-policy";
import {
  ApplicationAccessDeniedError,
  AuthenticationRequiredError,
} from "@/server/auth/errors";
import { requireBusinessMembership } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

export default async function ApplicationPage() {
  let principal;

  try {
    principal = await requireBusinessMembership();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?next=/app");
    }
    if (error instanceof ApplicationAccessDeniedError) {
      redirect("/access-denied");
    }
    throw error;
  }

  redirect(defaultApplicationRoute(principal.role));
}
