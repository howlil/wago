export type RuntimeConfigForValidation = {
  nodeEnv: string;
  allowWebBootstrap: boolean;
  apiKeyConfigured: boolean;
  authCookieSecure: boolean;
  corsOrigin: string;
};

export function validateRuntimeConfig(config: RuntimeConfigForValidation): string[] {
  if (config.nodeEnv !== "production") {
    return [];
  }

  const errors: string[] = [];

  if (config.allowWebBootstrap) {
    errors.push("ALLOW_WEB_BOOTSTRAP must be false in production.");
  }

  if (!config.apiKeyConfigured) {
    errors.push("API_KEY must be set or the app must already have a generated key in production.");
  }

  if (!config.authCookieSecure) {
    errors.push("AUTH_COOKIE_SECURE must be true in production.");
  }

  if (config.corsOrigin === "*") {
    errors.push("CORS_ORIGIN must not be * in production.");
  }

  return errors;
}
