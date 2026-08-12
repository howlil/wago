const MIN_WEBHOOK_SECRET_LENGTH = 32;

export type DeliveryWebhookConfig = {
  enabled: boolean;
  url: string | null;
  secret: string | null;
  previousSecret: string | null;
};

function clean(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateSecret(name: string, value: string): void {
  if (value.length < MIN_WEBHOOK_SECRET_LENGTH) {
    throw new Error(`${name} must contain at least ${MIN_WEBHOOK_SECRET_LENGTH} characters`);
  }
}

export function parseDeliveryWebhookConfig(env: NodeJS.ProcessEnv): DeliveryWebhookConfig {
  const url = clean(env.WEBHOOK_URL);
  const secret = clean(env.WEBHOOK_SECRET);
  const previousSecret = clean(env.WEBHOOK_SECRET_PREVIOUS);

  if (!url && !secret && !previousSecret) {
    return {
      enabled: false,
      url: null,
      secret: null,
      previousSecret: null,
    };
  }

  if (!url || !secret) {
    throw new Error("WEBHOOK_URL and WEBHOOK_SECRET must be configured together");
  }

  validateSecret("WEBHOOK_SECRET", secret);
  if (previousSecret) {
    validateSecret("WEBHOOK_SECRET_PREVIOUS", previousSecret);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("WEBHOOK_URL must be a valid URL");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("WEBHOOK_URL must use http or https");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("WEBHOOK_URL must not contain embedded credentials");
  }

  return {
    enabled: true,
    url: parsedUrl.toString(),
    secret,
    previousSecret,
  };
}
