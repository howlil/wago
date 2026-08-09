import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const nodeEnv = process.env.NODE_ENV?.trim() || "development";
const dataDirectory =
  nodeEnv === "production"
    ? "/app/data"
    : nodeEnv === "test"
      ? resolve(moduleDirectory, "..", "..", "data-test")
      : resolve(moduleDirectory, "..", "..", "data");
const settingsFile = resolve(dataDirectory, "app-settings.json");
const envApiKey = process.env.API_KEY?.trim();
const envCorsOrigin = process.env.CORS_ORIGIN?.trim();

type ApiKeySource = "env" | "generated" | "unset";

type PersistedSettings = {
  appId?: string;
  apiKey?: string;
  apiKeyHash?: string;
  generatedAt?: string;
};

function readSettings(): PersistedSettings {
  if (!existsSync(settingsFile)) {
    return {};
  }

  return JSON.parse(readFileSync(settingsFile, "utf8")) as PersistedSettings;
}

function writeSettings(settings: PersistedSettings): void {
  mkdirSync(dataDirectory, { recursive: true });
  writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
}

function generateApiKey(): string {
  return `wa_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

const persistedSettings = readSettings();
const initialAppId = persistedSettings.appId || `wa-gateway-${randomUUID().slice(0, 8)}`;
const persistedApiKeyHash =
  persistedSettings.apiKeyHash || (persistedSettings.apiKey ? hashApiKey(persistedSettings.apiKey) : null);

if (!persistedSettings.appId || (persistedSettings.apiKey && !persistedSettings.apiKeyHash)) {
  writeSettings({
    ...persistedSettings,
    appId: initialAppId,
    apiKey: undefined,
    apiKeyHash: persistedApiKeyHash ?? undefined,
  });
}

export const config = {
  appId: initialAppId,
  allowWebBootstrap: !envApiKey && !persistedApiKeyHash,
  apiKey: envApiKey || null,
  apiKeyHash: envApiKey ? null : persistedApiKeyHash,
  apiKeySource: (envApiKey ? "env" : persistedApiKeyHash ? "generated" : "unset") as ApiKeySource,
  authCookieName: "wa_gateway_api_key",
  authCookieSecure: nodeEnv === "production",
  bodyLimit: "32kb",
  authDirectory: resolve(dataDirectory, "auth"),
  corsOrigin: envCorsOrigin || "*",
  dataDirectory,
  frontendDirectory: nodeEnv === "production" ? "/app/public" : null,
  nodeEnv,
  requestLogging: true,
  trustProxy: false,
  defaultCountryCode: "62",
  logLevel: nodeEnv === "production" ? "info" : "debug",
};

export function bootstrapApiKey():
  | { success: true; appId: string; apiKey: string }
  | { success: false; message: string } {
  if (config.apiKey || config.apiKeyHash) {
    return {
      success: false,
      message: "This app is already initialized. Use the existing API key or auth cookie.",
    };
  }

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  writeSettings({
    ...readSettings(),
    appId: config.appId,
    apiKeyHash,
    generatedAt: new Date().toISOString(),
  });

  config.apiKey = null;
  config.apiKeyHash = apiKeyHash;
  config.apiKeySource = "generated";
  config.allowWebBootstrap = false;

  return {
    success: true,
    appId: config.appId,
    apiKey,
  };
}
