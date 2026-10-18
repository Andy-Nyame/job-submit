export interface ServiceActionState {
  message?: string;
  status: "idle" | "error" | "success";
}

export const INITIAL_SERVICE_ACTION_STATE: ServiceActionState = {
  status: "idle",
};
