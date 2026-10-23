import "server-only";

import { QUOTATION_MANAGER_ROLES } from "@/domain/quotation-policy";
import { requireAnyRole } from "@/server/auth/authorization";

export function requireQuotationManager() {
  return requireAnyRole(QUOTATION_MANAGER_ROLES);
}
