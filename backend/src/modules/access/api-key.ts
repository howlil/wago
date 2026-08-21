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
  generatedAt: string | null;
  setupCodeHash: string | null;
  setupCodeGeneratedAt: string | null;
};

export type AccessSnapshot = {
  appId: string;
  apiKeySource: ApiKeySource;
  apiKeyConfigured: boolean;
  credentialSetupRequired: boolean;
  setupCodeRequired: boolean;
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
    setupCodeHash: null,
    setupCodeGeneratedAt: null,
  });
}

let state: MutableAccessState = {
  appId: initialAppId,
  apiKey: config.deploymentApiKey,
  apiKeyHash: config.deploymentApiKey ? null : (persistedSettings?.apiKeyHash ?? null),
  apiKeySource: config.deploymentApiKey ? "env" : persistedSettings?.apiKeyHash ? "generated" : "unset",
  generatedAt: persistedSettings?.generatedAt ?? null,
  setupCodeHash: persistedSettings?.setupCodeHash ?? null,
  setupCodeGeneratedAt: persistedSettings?.setupCodeGeneratedAt ?? null,
};

let generatedSetupCodeForLog: string | null = null;

function generateApiKey(): string {
  return `wa_${randomBytes(32).toString("base64url")}`;
}

function generateSetupCode(): string {
  return `setup_${randomBytes(16).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

function hashSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function hashSetupCode(setupCode: string): string {
  return createHash("sha256").update(setupCode).digest("hex");
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
    setupCodeHash: nextState.setupCodeHash,
    setupCodeGeneratedAt: nextState.setupCodeGeneratedAt,
  });
  state = nextState;
}

function persistSetupCode(setupCode: string): void {
  saveState({
    ...state,
    setupCodeHash: hashSetupCode(setupCode),
    setupCodeGeneratedAt: new Date().toISOString(),
  });
}

function prepareFirstRunSetupCode(): void {
  if (config.nodeEnv !== "production" || state.apiKey || state.apiKeyHash) return;

  if (config.setupToken) {
    persistSetupCode(config.setupToken);
    return;
  }

  const setupCode = generateSetupCode();
  persistSetupCode(setupCode);
  generatedSetupCodeForLog = setupCode;
}

prepareFirstRunSetupCode();

export function consumeGeneratedSetupCodeForLog(): string | null {
  const setupCode = generatedSetupCodeForLog;
  generatedSetupCodeForLog = null;
  return setupCode;
}

export function getAccessSnapshot(): AccessSnapshot {
  const apiKeyConfigured = Boolean(state.apiKey || state.apiKeyHash);
  const setupCodeRequired =
    !apiKeyConfigured &&
    config.nodeEnv === "production" &&
    Boolean(state.setupCodeHash || config.setupToken);

  return {
    appId: state.appId,
    apiKeySource: state.apiKeySource,
    apiKeyConfigured,
    credentialSetupRequired: !apiKeyConfigured,
    setupCodeRequired,
    webBootstrapEnabled: !apiKeyConfigured && (config.nodeEnv !== "production" || setupCodeRequired),
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

export function isSetupCodeValid(candidate: string): boolean {
  if (!candidate) return false;

  const expectedHash = state.setupCodeHash ?? (config.setupToken ? hashSetupCode(config.setupToken) : null);
  if (!expectedHash) return false;

  return timingSafeEqual(Buffer.from(hashSetupCode(candidate), "hex"), Buffer.from(expectedHash, "hex"));
}

/** @deprecated Use isSetupCodeValid. Retained during the SETUP_TOKEN compatibility window. */
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
      message: "This app is already initialized. Use the existing API key to sign in or authenticate API requests.",
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
    setupCodeHash: null,
    setupCodeGeneratedAt: null,
  });
  generatedSetupCodeForLog = null;

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
    setupCodeHash: null,
    setupCodeGeneratedAt: null,
  });

  return { success: true, apiKey, generatedAt };
}

export function resetAccessStateForTest(
  overrides: Partial<
    Pick<
      MutableAccessState,
      "apiKey" | "apiKeyHash" | "apiKeySource" | "generatedAt" | "setupCodeHash" | "setupCodeGeneratedAt"
    >
  > = {},
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
    setupCodeHash: overrides.setupCodeHash ?? null,
    setupCodeGeneratedAt: overrides.setupCodeGeneratedAt ?? null,
  });
  generatedSetupCodeForLog = null;
}
