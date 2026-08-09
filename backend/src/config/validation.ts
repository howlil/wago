export type RuntimeConfigForValidation = {
  nodeEnv: string;
  corsOrigin: string;
};

export function validateRuntimeConfig(config: RuntimeConfigForValidation): string[] {
  if (config.nodeEnv !== "production") {
    return [];
  }

  const errors: string[] = [];

  if (!config.corsOrigin || config.corsOrigin === "*") {
    errors.push("CORS_ORIGIN is required in production and must not be *.");
  }

  return errors;
}
