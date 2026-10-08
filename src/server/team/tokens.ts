import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function createWorkerInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashWorkerInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function workerInvitationPath(token: string) {
  return `/invite/redeem#token=${encodeURIComponent(token)}`;
}
