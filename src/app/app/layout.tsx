import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getApplicationPrincipal } from "@/server/auth/authorization";

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  const principal = await getApplicationPrincipal();
  if (!principal) {
    redirect("/login?next=/app");
  }
  if (!principal.access.allowed) {
    redirect("/access-denied");
  }

  return <AppShell principal={principal}>{children}</AppShell>;
}
