import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDataDirectory =
  process.env.NODE_ENV === "test" ? resolve(moduleDirectory, "..", "data-test") : resolve(moduleDirectory, "..", "data");
const dataDirectory = process.env.DATA_DIR?.trim() || defaultDataDirectory;
const settingsFile = process.env.APP_SETTINGS_FILE?.trim() || resolve(dataDirectory, "app-settings.json");
const envAppId = process.env.APP_ID?.trim();
const envApiKey = process.env.API_KEY?.trim();

type ApiKeySource = "env" | "generated" | "unset";

type PersistedSettings = {
  appId?: string;
  apiKey?: string;
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

const persistedSettings = readSettings();
const initialAppId = envAppId || persistedSettings.appId || `wa-gateway-${randomUUID().slice(0, 8)}`;

if (!envAppId && !persistedSettings.appId) {
  writeSettings({
    ...persistedSettings,
    appId: initialAppId
  });
}

export const config = {
  appId: initialAppId,
  apiKey: envApiKey || persistedSettings.apiKey || null,
  apiKeySource: (envApiKey ? "env" : persistedSettings.apiKey ? "generated" : "unset") as ApiKeySource,
  authCookieName: process.env.AUTH_COOKIE_NAME?.trim() || "wa_gateway_api_key",
  authCookieSecure: process.env.AUTH_COOKIE_SECURE?.toLowerCase() === "true",
  authDirectory: process.env.AUTH_DIR?.trim() || resolve(dataDirectory, "auth"),
  corsOrigin: process.env.CORS_ORIGIN?.trim() || "*",
  dataDirectory,
  frontendDirectory: process.env.FRONTEND_DIST?.trim() || null
};

export function bootstrapApiKey(): { success: true; appId: string; apiKey: string } | { success: false; message: string } {
  if (config.apiKey) {
    return {
      success: false,
      message: "This app is already initialized. Use the existing API key or auth cookie."
    };
  }

  const apiKey = generateApiKey();

  writeSettings({
    ...readSettings(),
    appId: config.appId,
    apiKey,
    generatedAt: new Date().toISOString()
  });

  config.apiKey = apiKey;
  config.apiKeySource = "generated";

  return {
    success: true,
    appId: config.appId,
    apiKey
  };
}
