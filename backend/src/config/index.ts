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
const generatedApiKeyPattern = /^wa_[A-Za-z0-9_-]{43,64}$/;

type ApiKeySource = "env" | "generated" | "unset";

type PersistedSettings = {
  appId?: string;
  apiKey?: string;
  apiKeyHash?: string;
  generatedAt?: string;
};

export type BootstrapApiKeyResult =
  | { success: true; appId: string; apiKey: string; recovered: boolean }
  | { success: false; error: "APP_ALREADY_INITIALIZED" | "INVALID_API_KEY"; message: string };

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

export function bootstrapApiKey(requestedApiKey?: string): BootstrapApiKeyResult {
  const candidate = requestedApiKey?.trim();

  if (candidate && !generatedApiKeyPattern.test(candidate)) {
    return {
      success: false,
      error: "INVALID_API_KEY",
      message: "Generated API keys must use the wa_ prefix and contain at least 32 bytes of random entropy.",
    };
  }

  if (
    candidate &&
    config.apiKeySource === "generated" &&
    config.apiKeyHash &&
    hashApiKey(candidate) === config.apiKeyHash
  ) {
    return {
      success: true,
      appId: config.appId,
      apiKey: candidate,
      recovered: true,
    };
  }

  if (config.apiKey || config.apiKeyHash) {
    return {
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app is already initialized. Use the existing API key or auth cookie.",
    };
  }

  const apiKey = candidate || generateApiKey();
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
    recovered: false,
  };
}
