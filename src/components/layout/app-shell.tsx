import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { ApplicationPrincipal } from "@/server/auth/provisioning";

import { AppNavigation } from "./app-navigation";

function AccountActions({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={mobile ? "grid grid-cols-[auto_1fr] gap-3" : "flex items-center gap-3"}>
      <ThemeToggle className="bg-surface-raised" />
      <LogoutButton className={mobile ? "w-full" : "flex-1"} />
    </div>
  );
}

export function AppShell({
  children,
  principal,
}: {
  children: ReactNode;
  principal: ApplicationPrincipal;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <AppNavigation
        desktopActions={<AccountActions />}
        displayName={principal.displayName}
        email={principal.email}
        mobileActions={<AccountActions mobile />}
        role={principal.role}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
