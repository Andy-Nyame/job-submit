import type { ApplicationRole } from "./auth-policy";

export type ApplicationNavigationIcon =
  | "briefcase"
  | "dashboard"
  | "document-add"
  | "documents"
  | "notifications"
  | "profile"
  | "services"
  | "team";

export type ApplicationNavigationGroup =
  | "Account"
  | "Administration"
  | "Customer jobs"
  | "Operations"
  | "Workspace";

export interface ApplicationNavigationItem {
  group: ApplicationNavigationGroup;
  href: string;
  icon: ApplicationNavigationIcon;
  label: string;
}

const OVERVIEW: ApplicationNavigationItem = {
  group: "Workspace",
  href: "/app",
  icon: "dashboard",
  label: "Overview",
};

const NOTIFICATIONS: ApplicationNavigationItem = {
  group: "Workspace",
  href: "/app/notifications",
  icon: "notifications",
  label: "Notifications",
};

const ROLE_NAVIGATION: Record<
  ApplicationRole,
  readonly ApplicationNavigationItem[]
> = {
  CUSTOMER: [
    OVERVIEW,
    NOTIFICATIONS,
    {
      group: "Customer jobs",
      href: "/app/jobs/new",
      icon: "document-add",
      label: "Submit a job",
    },
    {
      group: "Customer jobs",
      href: "/app/jobs",
      icon: "documents",
      label: "My jobs",
    },
  ],
  WORKER: [
    OVERVIEW,
    NOTIFICATIONS,
    {
      group: "Operations",
      href: "/app/staff/jobs",
      icon: "briefcase",
      label: "Staff jobs",
    },
    {
      group: "Account",
      href: "/app/profile",
      icon: "profile",
      label: "My profile",
    },
  ],
  ADMIN: [
    OVERVIEW,
    NOTIFICATIONS,
    {
      group: "Operations",
      href: "/app/staff/jobs",
      icon: "briefcase",
      label: "Staff jobs",
    },
    {
      group: "Administration",
      href: "/app/services",
      icon: "services",
      label: "Services",
    },
    {
      group: "Administration",
      href: "/app/team",
      icon: "team",
      label: "Team",
    },
  ],
  OWNER: [
    OVERVIEW,
    NOTIFICATIONS,
    {
      group: "Operations",
      href: "/app/staff/jobs",
      icon: "briefcase",
      label: "Staff jobs",
    },
    {
      group: "Administration",
      href: "/app/services",
      icon: "services",
      label: "Services",
    },
    {
      group: "Administration",
      href: "/app/team",
      icon: "team",
      label: "Team",
    },
  ],
};

export function getApplicationNavigation(role: ApplicationRole) {
  return ROLE_NAVIGATION[role];
}

export function getActiveApplicationNavigationHref(
  pathname: string,
  items: readonly ApplicationNavigationItem[],
) {
  let activeHref: string | null = null;
  for (const item of items) {
    const matches =
      pathname === item.href ||
      (item.href !== "/app" && pathname.startsWith(`${item.href}/`));
    if (matches && (!activeHref || item.href.length > activeHref.length)) {
      activeHref = item.href;
    }
  }
  return activeHref;
}
