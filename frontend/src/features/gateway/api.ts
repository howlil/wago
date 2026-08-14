import { requestJson } from "../../shared/api/client.js";

const LEGACY_API_KEY_SESSION_STORAGE_KEY = "wago.apiKey";

if (typeof window !== "undefined") {
  window.sessionStorage.removeItem(LEGACY_API_KEY_SESSION_STORAGE_KEY);
}

export type AppInfoResponse = {
  success: true;
  appId: string;
  apiKeyRequired: boolean;
  apiKeyConfigured: boolean;
  apiKeySource: "env" | "generated" | "unset";
  authenticated: boolean;
  credentialSetupRequired: boolean;
  setupRequired: boolean;
  setupTokenRequired?: boolean;
  webBootstrapEnabled?: boolean;
};

export type BootstrapAppResponse =
  | {
      success: true;
      appId: string;
      apiKey: string;
      recovered: boolean;
      sessionExpiresAt: string;
      message: string;
    }
  | {
      success: false;
      error: string;
      message: string;
    };

export type BrowserSessionResponse =
  | {
      success: true;
      authenticated: boolean;
      expiresAt?: string;
      revokedBrowserSessions?: number;
      message: string;
    }
  | {
      success: false;
      error: string;
      message: string;
    };

export type ApiKeyRotationResponse =
  | {
      success: true;
      apiKey: string;
      generatedAt: string;
      revokedBrowserSessions?: number;
      message: string;
    }
  | {
      success: false;
      error: string;
      message: string;
    };

export type HealthResponse = {
  status: string;
};

export function createApiKeyCandidate(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `wa_${hex}`;
}

export function getAppInfo(): Promise<AppInfoResponse> {
  return requestJson<AppInfoResponse>("/app/info");
}

export function bootstrapApp(candidate: string, setupToken?: string): Promise<BootstrapAppResponse> {
  return requestJson<BootstrapAppResponse>("/app/bootstrap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(setupToken ? { "X-Wago-Setup-Token": setupToken } : {}),
    },
    body: JSON.stringify({ apiKey: candidate }),
  });
}

export function createBrowserSession(apiKey: string): Promise<BrowserSessionResponse> {
  return requestJson<BrowserSessionResponse>("/app/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
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
