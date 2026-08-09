export type RuntimeConfigForValidation = {
  nodeEnv: string;
  apiKeyConfigured: boolean;
  corsOrigin: string;
};

export function validateRuntimeConfig(config: RuntimeConfigForValidation): string[] {
  if (config.nodeEnv !== "production") {
    return [];
  }

  const errors: string[] = [];

  if (!config.apiKeyConfigured) {
    errors.push("API_KEY is required in production.");
  }

  if (!config.corsOrigin || config.corsOrigin === "*") {
    errors.push("CORS_ORIGIN is required in production and must not be *.");
  }

  return errors;
}
