import "server-only";

export function isEmailPasswordSignupEnabled() {
  return process.env.EMAIL_PASSWORD_SIGNUP_ENABLED === "true";
}
