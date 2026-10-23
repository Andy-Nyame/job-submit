import "server-only";

import { requireRole } from "@/server/auth/authorization";

export function requireCustomer() {
  return requireRole("CUSTOMER");
}
