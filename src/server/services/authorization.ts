import "server-only";

import { SERVICE_MANAGER_ROLES } from "@/domain/service-policy";
import { requireAnyRole } from "@/server/auth/authorization";

export function requireServiceManager() {
  return requireAnyRole(SERVICE_MANAGER_ROLES);
}
