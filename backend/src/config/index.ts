import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { getDatabase } from "../infrastructure/database.js";
import { createWebhookSettingsStore } from "../webhooks/settings-store.js";
import { dataDirectory, nodeEnv } from "./runtime-paths.js";
import { parseDeliveryWebhookConfig } from "./webhook-config.js";

const envApiKey = process.env.API_KEY?.trim();
const rawSetupToken = process.env.SETUP_TOKEN?.trim();
const envSetupToken = rawSetupToken && Buffer.byteLength(rawSetupToken, "utf8") >= 32 ? rawSetupToken : null;
const generatedApiKeyPattern = /^wa_[A-Za-z0-9_-]{43,64}$/;

type ApiKeySource = "env" | "generated" | "unset";

type PersistedSettings = {
  appId: string;
  apiKeyHash: string | null;
  generatedAt: string | null;
};

export type BootstrapApiKeyResult =
  | { success: true; appId: string; apiKey: string; recovered: boolean }
  | { success: false; error: "APP_ALREADY_INITIALIZED" | "INVALID_API_KEY"; message: string };

export type ApiKeyRotationResult =
  | { success: true; apiKey: string; generatedAt: string }
  | { success: false; error: "API_KEY_MANAGED_BY_ENV" | "GATEWAY_NOT_INITIALIZED"; message: string };

const database = getDatabase();
const webhookSettingsStore = createWebhookSettingsStore(database);
const persistedWebhookSettings = webhookSettingsStore.get();
const legacyDeliveryWebhook = persistedWebhookSettings
  ? {
      enabled: persistedWebhookSettings.enabled,
      url: persistedWebhookSettings.url,
      secret: persistedWebhookSettings.secret,
      previousSecret: persistedWebhookSettings.previousSecret,
    }
  : parseDeliveryWebhookConfig(process.env);

if (!persistedWebhookSettings) {
  webhookSettingsStore.importLegacyIfEmpty(legacyDeliveryWebhook);
}

const readSettingsStatement = database.prepare(
  "SELECT app_id, api_key_hash, generated_at FROM app_settings WHERE id = 1",
);
const writeSettingsStatement = database.prepare(`
  INSERT INTO app_settings (id, app_id, api_key_hash, generated_at)
  VALUES (1, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    app_id = excluded.app_id,
    api_key_hash = excluded.api_key_hash,
    generated_at = excluded.generated_at
`);

function readSettings(): PersistedSettings | null {
  const row = readSettingsStatement.get() as
    | { app_id?: string; api_key_hash?: string | null; generated_at?: string | null }
    | undefined;

  if (!row?.app_id) return null;
  return {
    appId: row.app_id,
    apiKeyHash: row.api_key_hash ?? null,
    generatedAt: row.generated_at ?? null,
  };
}

function writeSettings(settings: PersistedSettings): void {
  writeSettingsStatement.run(settings.appId, settings.apiKeyHash, settings.generatedAt);
}

function generateApiKey(): string {
  return `wa_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

function hashSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

const persistedSettings = readSettings();
const initialAppId = persistedSettings?.appId ?? `wa-gateway-${randomUUID().slice(0, 8)}`;
const persistedApiKeyHash = persistedSettings?.apiKeyHash ?? null;

if (!persistedSettings) {
  writeSettings({ appId: initialAppId, apiKeyHash: null, generatedAt: null });
}

export const config = {
  appId: initialAppId,
  allowWebBootstrap: !envApiKey && !persistedApiKeyHash && (nodeEnv !== "production" || Boolean(envSetupToken)),
  setupToken: envSetupToken as string | null,
  apiKey: envApiKey || null,
  apiKeyHash: envApiKey ? null : persistedApiKeyHash,
  apiKeySource: (envApiKey ? "env" : persistedApiKeyHash ? "generated" : "unset") as ApiKeySource,
  authCookieName: "wago_session",
  legacyAuthCookieName: "wa_gateway_api_key",
  authCookieSecure: nodeEnv === "production",
  browserSessionMaxAgeMs: 1000 * 60 * 60 * 24 * 30,
  bodyLimit: "32kb",
  authDirectory: resolve(dataDirectory, "auth"),
  dataDirectory,
  deliveryWebhookEnabled: legacyDeliveryWebhook.enabled,
  deliveryWebhookUrl: legacyDeliveryWebhook.url,
  deliveryWebhookSecret: legacyDeliveryWebhook.secret,
  deliveryWebhookPreviousSecret: legacyDeliveryWebhook.previousSecret,
  frontendDirectory: nodeEnv === "production" ? "/app/public" : null,
  nodeEnv,
  requestLogging: true,
  trustProxy: false,
  defaultCountryCode: "62",
  logLevel: nodeEnv === "production" ? "info" : "debug",
};

export function isSetupTokenValid(candidate: string): boolean {
  if (!config.setupToken || !candidate) return false;
  return timingSafeEqual(hashSecret(candidate), hashSecret(config.setupToken));
}

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
    return { success: true, appId: config.appId, apiKey: candidate, recovered: true };
  }

  if (config.apiKey || config.apiKeyHash) {
    return {
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app is already initialized. Use the existing API key to sign in or authenticate API requests.",
    };
  }

  const apiKey = candidate || generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  writeSettings({ appId: config.appId, apiKeyHash, generatedAt: new Date().toISOString() });
  config.apiKey = null;
  config.apiKeyHash = apiKeyHash;
  config.apiKeySource = "generated";
  config.allowWebBootstrap = false;

  return { success: true, appId: config.appId, apiKey, recovered: false };
}

export function rotateGeneratedApiKey(): ApiKeyRotationResult {
  if (config.apiKeySource === "env") {
    return {
      success: false,
      error: "API_KEY_MANAGED_BY_ENV",
      message: "This API key is managed by the deployment environment and must be rotated there.",
    };
  }

  if (config.apiKeySource !== "generated" || !config.apiKeyHash) {
    return {
      success: false,
      error: "GATEWAY_NOT_INITIALIZED",
      message: "Initialize the gateway before rotating its API key.",
    };
  }

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const generatedAt = new Date().toISOString();
  writeSettings({ appId: config.appId, apiKeyHash, generatedAt });

  config.apiKey = null;
  config.apiKeyHash = apiKeyHash;
  config.apiKeySource = "generated";
  config.allowWebBootstrap = false;

  return { success: true, apiKey, generatedAt };
}

export function resetPersistedSettingsForTest(): void {
  database.prepare("DELETE FROM app_settings").run();
  writeSettings({ appId: config.appId, apiKeyHash: null, generatedAt: null });
}
