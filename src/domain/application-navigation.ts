import type { ApplicationRole } from "./auth-policy";

export type ApplicationNavigationIcon =
  | "briefcase"
  | "document-add"
  | "documents"
  | "profile"
  | "services"
  | "team";

export type ApplicationNavigationGroup =
  | "Account"
  | "Administration"
  | "Customer jobs"
  | "Operations";

export interface ApplicationNavigationItem {
  group: ApplicationNavigationGroup;
  href: string;
  icon: ApplicationNavigationIcon;
  label: string;
}

const ROLE_NAVIGATION: Record<
  ApplicationRole,
  readonly ApplicationNavigationItem[]
> = {
  CUSTOMER: [
    {
      group: "Customer jobs",
      href: "/app/jobs/new",
      icon: "document-add",
      label: "Submit a Job",
    },
    {
      group: "Customer jobs",
      href: "/app/jobs",
      icon: "documents",
      label: "My Jobs",
    },
    {
      group: "Account",
      href: "/app/profile",
      icon: "profile",
      label: "My Account",
    },
  ],
  WORKER: [
    {
      group: "Operations",
      href: "/app/staff/jobs",
      icon: "briefcase",
      label: "Jobs",
    },
    {
      group: "Account",
      href: "/app/profile",
      icon: "profile",
      label: "My Account",
    },
  ],
  ADMIN: [
    {
      group: "Operations",
      href: "/app/staff/jobs",
      icon: "briefcase",
      label: "Jobs",
    },
    {
      group: "Administration",
      href: "/app/services",
      icon: "services",
      label: "Shop & Services",
    },
    {
      group: "Administration",
      href: "/app/team",
      icon: "team",
      label: "Team",
    },
  ],
  OWNER: [
    {
      group: "Operations",
      href: "/app/staff/jobs",
      icon: "briefcase",
      label: "Jobs",
    },
    {
      group: "Administration",
      href: "/app/services",
      icon: "services",
      label: "Shop & Services",
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
