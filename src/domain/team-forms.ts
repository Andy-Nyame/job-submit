export interface TeamActionState {
  invitationPath?: string;
  message?: string;
  status: "idle" | "error" | "success";
}

export const INITIAL_TEAM_ACTION_STATE: TeamActionState = { status: "idle" };
