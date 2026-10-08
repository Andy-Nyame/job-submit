import "server-only";

export type TeamOperationErrorCode =
  | "ALREADY_WORKER"
  | "BLOCKED_ACCOUNT"
  | "DUPLICATE_INVITATION"
  | "INVITATION_UNAVAILABLE"
  | "NOT_FOUND"
  | "PRIVILEGED_MEMBERSHIP_PROTECTED"
  | "STALE_UPDATE"
  | "VALIDATION";

export class TeamOperationError extends Error {
  constructor(public readonly code: TeamOperationErrorCode) {
    super(code);
    this.name = "TeamOperationError";
  }
}
