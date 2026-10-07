export interface AuthActionState {
  fieldErrors?: {
    email?: string;
    name?: string;
    password?: string;
  };
  message?: string;
  success?: boolean;
}

export const INITIAL_AUTH_ACTION_STATE: AuthActionState = {};
