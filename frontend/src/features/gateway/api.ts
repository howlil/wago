import { ApiError, requestJson } from "../../shared/api/client.js";

export type AppInfoResponse = {
  success: true;
  appId: string;
  apiKeyRequired: boolean;
  apiKeyConfigured: boolean;
  apiKeySource: "env" | "generated" | "unset";
  authenticated: boolean;
  adminPasswordConfigured: boolean;
  credentialSetupRequired: boolean;
};

export type BootstrapAppResponse = {
  success: true;
  appId: string;
  apiKey: string;
  recovered: boolean;
  sessionExpiresAt?: string;
  message: string;
};

export type BrowserSessionResponse = {
  success: true;
  authenticated: boolean;
  expiresAt?: string;
  revokedBrowserSessions?: number;
  message: string;
};

export type ApiKeyRotationResponse = {
  success: true;
  apiKey: string;
  generatedAt: string;
  revokedBrowserSessions?: number;
  message: string;
};

export type HealthResponse = { status: string };

export type ReadinessLevel = "ok" | "degraded" | "not_ready";
export type ReadinessCheck = { status: ReadinessLevel; reason?: string };

export type GatewayReadinessSnapshot = {
  status: ReadinessLevel;
  checks: Record<string, ReadinessCheck>;
};

function isGatewayReadinessSnapshot(value: unknown): value is GatewayReadinessSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { status?: unknown; checks?: unknown };
  return (
    (candidate.status === "ok" || candidate.status === "degraded" || candidate.status === "not_ready") &&
    Boolean(candidate.checks) &&
    typeof candidate.checks === "object" &&
    !Array.isArray(candidate.checks)
  );
}

export function createApiKeyCandidate(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `wa_${hex}`;
}

export function getAppInfo(): Promise<AppInfoResponse> {
  return requestJson<AppInfoResponse>("/app/info");
}

export function bootstrapApp(candidate: string): Promise<BootstrapAppResponse> {
  return requestJson<BootstrapAppResponse>("/app/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: candidate }),
  });
}

export function createBrowserSession(password: string): Promise<BrowserSessionResponse> {
  return requestJson<BrowserSessionResponse>("/app/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export function rotateApiKey(): Promise<ApiKeyRotationResponse> {
  return requestJson<ApiKeyRotationResponse>("/app/api-key/rotate", { method: "POST" });
}

export function logoutBrowserSession(): Promise<BrowserSessionResponse> {
  return requestJson<BrowserSessionResponse>("/app/session/logout", { method: "POST" });
}

export function logoutAllBrowserSessions(): Promise<BrowserSessionResponse> {
  return requestJson<BrowserSessionResponse>("/app/session/logout-all", { method: "POST" });
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health");
}

export async function getReadiness(): Promise<GatewayReadinessSnapshot> {
  const value = await requestJson<unknown>("/ready", undefined, { allowedStatuses: [503] });
  if (!isGatewayReadinessSnapshot(value)) {
    throw new ApiError(0, "INVALID_READINESS_RESPONSE", "Readiness endpoint returned an invalid JSON payload", value);
  }
  return value;
}
