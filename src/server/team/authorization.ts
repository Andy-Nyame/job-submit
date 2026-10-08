import "server-only";

import { TEAM_MANAGER_ROLES } from "@/domain/team-policy";
import { requireAnyRole, requireRole } from "@/server/auth/authorization";

export function requireTeamManager() {
  return requireAnyRole(TEAM_MANAGER_ROLES);
}

export function requireWorker() {
  return requireRole("WORKER");
}

export function requireOwner() {
  return requireRole("OWNER");
}
