import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { config } from "../../config/index.js";
import { getDatabase } from "../../infrastructure/database.js";
import { createAppSettingsStore } from "./app-settings-store.js";

const generatedApiKeyPattern = /^wa_[A-Za-z0-9_-]{43,64}$/;

type ApiKeySource = "env" | "generated" | "unset";

type MutableAccessState = {
  appId: string;
  apiKey: string | null;
  apiKeyHash: string | null;
  apiKeySource: ApiKeySource;
};

export type AccessSnapshot = {
  appId: string;
  apiKeySource: ApiKeySource;
  apiKeyConfigured: boolean;
  credentialSetupRequired: boolean;
  webBootstrapEnabled: boolean;
};

export type BootstrapApiKeyResult =
  | { success: true; appId: string; apiKey: string; recovered: boolean }
  | { success: false; error: "APP_ALREADY_INITIALIZED" | "INVALID_API_KEY"; message: string };

export type ApiKeyRotationResult =
  | { success: true; apiKey: string; generatedAt: string }
  | { success: false; error: "API_KEY_MANAGED_BY_ENV" | "GATEWAY_NOT_INITIALIZED"; message: string };

const settingsStore = createAppSettingsStore(getDatabase());
const persistedSettings = settingsStore.get();
const initialAppId = persistedSettings?.appId ?? `wa-gateway-${randomUUID().slice(0, 8)}`;

if (!persistedSettings) {
  settingsStore.save({ appId: initialAppId, apiKeyHash: null, generatedAt: null });
}

let state: MutableAccessState = {
  appId: initialAppId,
  apiKey: config.deploymentApiKey,
  apiKeyHash: config.deploymentApiKey ? null : (persistedSettings?.apiKeyHash ?? null),
  apiKeySource: config.deploymentApiKey ? "env" : persistedSettings?.apiKeyHash ? "generated" : "unset",
};

function generateApiKey(): string {
  return `wa_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

function hashSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAccessSnapshot(): AccessSnapshot {
  const apiKeyConfigured = Boolean(state.apiKey || state.apiKeyHash);
  return {
    appId: state.appId,
    apiKeySource: state.apiKeySource,
    apiKeyConfigured,
    credentialSetupRequired: !apiKeyConfigured,
    webBootstrapEnabled:
      !apiKeyConfigured && (config.nodeEnv !== "production" || Boolean(config.setupToken)),
  };
}

export function isApiKeyConfigured(): boolean {
  return getAccessSnapshot().apiKeyConfigured;
}

export function isApiKeyValid(candidate: string): boolean {
  if (state.apiKey && constantTimeEquals(candidate, state.apiKey)) return true;
  if (state.apiKeyHash && constantTimeEquals(hashApiKey(candidate), state.apiKeyHash)) return true;
  return false;
}

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

  if (candidate && state.apiKeySource === "generated" && state.apiKeyHash && hashApiKey(candidate) === state.apiKeyHash) {
    return { success: true, appId: state.appId, apiKey: candidate, recovered: true };
  }

  if (state.apiKey || state.apiKeyHash) {
    return {
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app is already initialized. Use the existing API key to sign in or authenticate API requests.",
    };
  }

  const apiKey = candidate || generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  settingsStore.save({ appId: state.appId, apiKeyHash, generatedAt: new Date().toISOString() });
  state = { ...state, apiKey: null, apiKeyHash, apiKeySource: "generated" };

  return { success: true, appId: state.appId, apiKey, recovered: false };
}

export function rotateGeneratedApiKey(): ApiKeyRotationResult {
  if (state.apiKeySource === "env") {
    return {
      success: false,
      error: "API_KEY_MANAGED_BY_ENV",
      message: "This API key is managed by the deployment environment and must be rotated there.",
    };
  }

  if (state.apiKeySource !== "generated" || !state.apiKeyHash) {
    return {
      success: false,
      error: "GATEWAY_NOT_INITIALIZED",
      message: "Initialize the gateway before rotating its API key.",
    };
  }

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const generatedAt = new Date().toISOString();
  settingsStore.save({ appId: state.appId, apiKeyHash, generatedAt });
  state = { ...state, apiKey: null, apiKeyHash, apiKeySource: "generated" };

  return { success: true, apiKey, generatedAt };
}

export function resetAccessStateForTest(
  overrides: Partial<Pick<MutableAccessState, "apiKey" | "apiKeyHash" | "apiKeySource">> = {},
): void {
  const apiKey = overrides.apiKey ?? null;
  const apiKeyHash = apiKey ? null : (overrides.apiKeyHash ?? null);
  const apiKeySource = overrides.apiKeySource ?? (apiKey ? "env" : apiKeyHash ? "generated" : "unset");

  settingsStore.clear();
  settingsStore.save({ appId: state.appId, apiKeyHash: apiKeySource === "generated" ? apiKeyHash : null, generatedAt: null });
  state = { appId: state.appId, apiKey, apiKeyHash, apiKeySource };
}
