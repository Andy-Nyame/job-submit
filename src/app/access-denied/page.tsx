import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LogoutButton } from "@/components/auth/logout-button";
import { getApplicationPrincipal } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Access unavailable" };

export default async function AccessDeniedPage() {
  const principal = await getApplicationPrincipal();
  if (!principal) {
    redirect("/login");
  }
  if (principal.access.allowed) {
    redirect("/app");
  }

  return (
    <AuthShell
      description="This account cannot currently access the JobSubmit workspace. Contact the business if you believe this is unexpected."
      heading="Access unavailable"
    >
      <p className="mb-6 text-sm leading-6 text-muted">
        You can safely sign out and use a different account.
      </p>
      <LogoutButton />
    </AuthShell>
  );
}
