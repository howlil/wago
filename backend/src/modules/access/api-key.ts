import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { config } from "../../config/index.js";
import { getDatabase } from "../../infrastructure/database.js";
import { isAdminPasswordConfigured } from "./admin-password.js";
import { createAppSettingsStore } from "./app-settings-store.js";

const generatedApiKeyPattern = /^wa_[A-Za-z0-9_-]{43,64}$/;

type ApiKeySource = "env" | "generated" | "unset";

type MutableAccessState = {
  appId: string;
  apiKey: string | null;
  apiKeyHash: string | null;
  apiKeySource: ApiKeySource;
  generatedAt: string | null;
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
  settingsStore.save({
    appId: initialAppId,
    apiKeyHash: null,
    generatedAt: null,
  });
}

let state: MutableAccessState = {
  appId: initialAppId,
  apiKey: config.deploymentApiKey,
  apiKeyHash: config.deploymentApiKey ? null : (persistedSettings?.apiKeyHash ?? null),
  apiKeySource: config.deploymentApiKey ? "env" : persistedSettings?.apiKeyHash ? "generated" : "unset",
  generatedAt: persistedSettings?.generatedAt ?? null,
};

function generateApiKey(): string {
  return `wa_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function saveState(nextState: MutableAccessState): void {
  settingsStore.save({
    appId: nextState.appId,
    apiKeyHash: nextState.apiKeySource === "generated" ? nextState.apiKeyHash : null,
    generatedAt: nextState.generatedAt,
  });
  state = nextState;
}

export function getAccessSnapshot(): AccessSnapshot {
  const apiKeyConfigured = Boolean(state.apiKey || state.apiKeyHash);

  return {
    appId: state.appId,
    apiKeySource: state.apiKeySource,
    apiKeyConfigured,
    credentialSetupRequired: !apiKeyConfigured,
    webBootstrapEnabled: !apiKeyConfigured && (config.nodeEnv !== "production" || isAdminPasswordConfigured()),
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
    state.apiKeySource === "generated" &&
    state.apiKeyHash &&
    hashApiKey(candidate) === state.apiKeyHash
  ) {
    return { success: true, appId: state.appId, apiKey: candidate, recovered: true };
  }

  if (state.apiKey || state.apiKeyHash) {
    return {
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app already has a machine API key. Sign in to the dashboard with the configured admin credential.",
    };
  }

  const apiKey = candidate || generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const generatedAt = new Date().toISOString();

  saveState({
    ...state,
    apiKey: null,
    apiKeyHash,
    apiKeySource: "generated",
    generatedAt,
  });

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

  saveState({
    ...state,
    apiKey: null,
    apiKeyHash,
    apiKeySource: "generated",
    generatedAt,
  });

  return { success: true, apiKey, generatedAt };
}

export function resetAccessStateForTest(
  overrides: Partial<Pick<MutableAccessState, "apiKey" | "apiKeyHash" | "apiKeySource" | "generatedAt">> = {},
): void {
  const apiKey = overrides.apiKey ?? null;
  const apiKeyHash = apiKey ? null : (overrides.apiKeyHash ?? null);
  const apiKeySource = overrides.apiKeySource ?? (apiKey ? "env" : apiKeyHash ? "generated" : "unset");

  settingsStore.clear();
  saveState({
    appId: state.appId,
    apiKey,
    apiKeyHash,
    apiKeySource,
    generatedAt: overrides.generatedAt ?? null,
  });
}
