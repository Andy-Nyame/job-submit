import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getApplicationPrincipal } from "@/server/auth/authorization";
import { getNotificationShellData } from "@/server/notifications/queries";

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

  const notificationData = await getNotificationShellData(principal);

  return (
    <AppShell
      notifications={notificationData.notifications}
      principal={principal}
      unreadNotificationCount={notificationData.unreadCount}
    >
      {children}
    </AppShell>
  );
}
