import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDataDirectory =
  process.env.NODE_ENV === "test"
    ? resolve(moduleDirectory, "..", "..", "data-test")
    : resolve(moduleDirectory, "..", "..", "data");
const dataDirectory = process.env.DATA_DIR?.trim() || defaultDataDirectory;
const settingsFile = process.env.APP_SETTINGS_FILE?.trim() || resolve(dataDirectory, "app-settings.json");
const envAppId = process.env.APP_ID?.trim();
const envApiKey = process.env.API_KEY?.trim();
const nodeEnv = process.env.NODE_ENV?.trim() || "development";
const waVersionMode = process.env.WA_VERSION_MODE?.trim() === "live" ? "live" : "default";
const trustProxy = process.env.TRUST_PROXY?.toLowerCase() === "true" || process.env.TRUST_PROXY === "1";
const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE?.trim() || "62";
const logLevel = process.env.LOG_LEVEL?.trim() || (nodeEnv === "production" ? "info" : "debug");

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
const initialAppId = envAppId || persistedSettings.appId || `wa-gateway-${randomUUID().slice(0, 8)}`;
const persistedApiKeyHash =
  persistedSettings.apiKeyHash || (persistedSettings.apiKey ? hashApiKey(persistedSettings.apiKey) : null);

if ((!envAppId && !persistedSettings.appId) || (persistedSettings.apiKey && !persistedSettings.apiKeyHash)) {
  writeSettings({
    ...persistedSettings,
    appId: initialAppId,
    apiKey: undefined,
    apiKeyHash: persistedApiKeyHash ?? undefined,
  });
}

export const config = {
  appId: initialAppId,
  allowWebBootstrap: process.env.ALLOW_WEB_BOOTSTRAP?.toLowerCase() === "true" || nodeEnv !== "production",
  apiKey: envApiKey || null,
  apiKeyHash: envApiKey ? null : persistedApiKeyHash,
  apiKeySource: (envApiKey ? "env" : persistedApiKeyHash ? "generated" : "unset") as ApiKeySource,
  authCookieName: process.env.AUTH_COOKIE_NAME?.trim() || "wa_gateway_api_key",
  authCookieSecure: process.env.AUTH_COOKIE_SECURE?.toLowerCase() === "true",
  bodyLimit: process.env.BODY_LIMIT?.trim() || "32kb",
  authDirectory: process.env.AUTH_DIR?.trim() || resolve(dataDirectory, "auth"),
  corsOrigin: process.env.CORS_ORIGIN?.trim() || "*",
  dataDirectory,
  frontendDirectory: process.env.FRONTEND_DIST?.trim() || null,
  nodeEnv,
  requestLogging: process.env.REQUEST_LOGGING?.toLowerCase() !== "false",
  trustProxy,
  defaultCountryCode,
  logLevel,
  waVersionMode,
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

  writeSettings({
    ...readSettings(),
    appId: config.appId,
    apiKeyHash: hashApiKey(apiKey),
    generatedAt: new Date().toISOString(),
  });

  config.apiKey = null;
  config.apiKeyHash = hashApiKey(apiKey);
  config.apiKeySource = "generated";

  return {
    success: true,
    appId: config.appId,
    apiKey,
  };
}
