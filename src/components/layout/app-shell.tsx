import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { ShellNotification } from "@/components/notifications/notification-bell";
import { NotificationSoundListener } from "@/components/notifications/notification-sound";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";

import { AppNavigation } from "./app-navigation";
import { ForegroundRefresh } from "./foreground-refresh";

function AccountActions({
  mobile = false,
  showAccountLink,
}: {
  mobile?: boolean;
  showAccountLink: boolean;
}) {
  return (
    <div className="space-y-3">
      {showAccountLink ? (
        <Link
          className="flex min-h-11 w-full items-center justify-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
          href="/app/profile"
        >
          My Account
        </Link>
      ) : null}
      <div className={mobile ? "grid grid-cols-[auto_1fr] gap-3" : "flex items-center gap-3"}>
        <ThemeToggle className="bg-surface-raised" />
        <LogoutButton className={mobile ? "w-full" : "flex-1"} />
      </div>
    </div>
  );
}

export function AppShell({
  children,
  notifications,
  principal,
  unreadNotificationCount,
}: {
  children: ReactNode;
  notifications: readonly ShellNotification[];
  principal: ApplicationPrincipal;
  unreadNotificationCount: number;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <NotificationSoundListener notifications={notifications} role={principal.role} />
      <ForegroundRefresh />
      <AppNavigation
        desktopActions={
          <AccountActions
            showAccountLink={principal.role === "OWNER" || principal.role === "ADMIN"}
          />
        }
        displayName={principal.displayName}
        email={principal.email}
        mobileActions={
          <AccountActions
            mobile
            showAccountLink={principal.role === "OWNER" || principal.role === "ADMIN"}
          />
        }
        notifications={notifications}
        role={principal.role}
        unreadNotificationCount={unreadNotificationCount}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
