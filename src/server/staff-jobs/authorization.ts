import "server-only";

import { STAFF_JOB_ROLES } from "@/domain/staff-job-policy";
import { requireAnyRole } from "@/server/auth/authorization";

export function requireStaffJobAccess() {
  return requireAnyRole(STAFF_JOB_ROLES);
}
