export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthenticationUnavailableError extends Error {
  constructor() {
    super("Authentication could not be verified.");
    this.name = "AuthenticationUnavailableError";
  }
}

export class ApplicationAccessDeniedError extends Error {
  constructor() {
    super("Application access is not available for this account.");
    this.name = "ApplicationAccessDeniedError";
  }
}

export class ApplicationConfigurationError extends Error {
  constructor() {
    super("Application identity configuration is unavailable.");
    this.name = "ApplicationConfigurationError";
  }
}

export class RoleRequiredError extends Error {
  constructor() {
    super("The required application role is not present.");
    this.name = "RoleRequiredError";
  }
}
