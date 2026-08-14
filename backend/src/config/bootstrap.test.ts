import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "../infrastructure/database.js";
import {
  bootstrapApiKey,
  getAccessSnapshot,
  hashApiKey,
  isApiKeyValid,
  resetAccessStateForTest,
  rotateGeneratedApiKey,
} from "../modules/access/api-key.js";
import { createAppSettingsStore } from "../modules/access/app-settings-store.js";

const candidate = `wa_${"b".repeat(64)}`;
const settingsStore = createAppSettingsStore(getDatabase());

beforeEach(() => {
  resetAccessStateForTest();
});

describe("bootstrap API key", () => {
  it("persists only the hash of a browser-generated API key", () => {
    const result = bootstrapApiKey(candidate);
    expect(result).toMatchObject({ success: true, appId: getAccessSnapshot().appId, apiKey: candidate, recovered: false });
    expect(settingsStore.get()?.apiKeyHash).toBe(hashApiKey(candidate));
    expect(isApiKeyValid(candidate)).toBe(true);
  });

  it("is idempotent when the same browser retries after losing the first response", () => {
    expect(bootstrapApiKey(candidate)).toMatchObject({ success: true, recovered: false });
    expect(bootstrapApiKey(candidate)).toMatchObject({ success: true, apiKey: candidate, recovered: true });
  });

  it("rejects a different key after the gateway has already been initialized", () => {
    expect(bootstrapApiKey(candidate)).toMatchObject({ success: true });
    expect(bootstrapApiKey(`wa_${"c".repeat(64)}`)).toEqual({
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app is already initialized. Use the existing API key to sign in or authenticate API requests.",
    });
  });
});

describe("generated API key rotation", () => {
  it("replaces the active generated credential with a fresh key while persisting only its hash", () => {
    expect(bootstrapApiKey(candidate)).toMatchObject({ success: true });
    const previousHash = settingsStore.get()?.apiKeyHash;
    const result = rotateGeneratedApiKey();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected successful rotation");
    expect(result.apiKey).toMatch(/^wa_[A-Za-z0-9_-]{43,64}$/);
    expect(result.apiKey).not.toBe(candidate);
    expect(result.generatedAt).toBeTruthy();
    expect(getAccessSnapshot().apiKeySource).toBe("generated");
    expect(settingsStore.get()?.apiKeyHash).toBe(hashApiKey(result.apiKey));
    expect(settingsStore.get()?.apiKeyHash).not.toBe(previousHash);
    expect(isApiKeyValid(result.apiKey)).toBe(true);
    expect(isApiKeyValid(candidate)).toBe(false);
  });

  it("refuses to rotate an environment-managed API key", () => {
    resetAccessStateForTest({ apiKey: "deployment-owned-key", apiKeySource: "env" });

    expect(rotateGeneratedApiKey()).toEqual({
      success: false,
      error: "API_KEY_MANAGED_BY_ENV",
      message: "This API key is managed by the deployment environment and must be rotated there.",
    });
    expect(isApiKeyValid("deployment-owned-key")).toBe(true);
  });
});
