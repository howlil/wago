import { beforeEach, describe, expect, it } from "vitest";
import { bootstrapApiKey, config, hashApiKey, resetPersistedSettingsForTest } from "./index.js";

const candidate = `wa_${"b".repeat(64)}`;

beforeEach(() => {
  resetPersistedSettingsForTest();
  config.allowWebBootstrap = true;
  config.apiKey = null;
  config.apiKeyHash = null;
  config.apiKeySource = "unset";
});

describe("bootstrap API key", () => {
  it("persists only the hash of a browser-generated API key", () => {
    const result = bootstrapApiKey(candidate);

    expect(result).toMatchObject({
      success: true,
      appId: config.appId,
      apiKey: candidate,
      recovered: false,
    });
    expect(config.apiKey).toBeNull();
    expect(config.apiKeyHash).toBe(hashApiKey(candidate));
  });

  it("is idempotent when the same browser retries after losing the first response", () => {
    expect(bootstrapApiKey(candidate)).toMatchObject({ success: true, recovered: false });
    expect(bootstrapApiKey(candidate)).toMatchObject({
      success: true,
      apiKey: candidate,
      recovered: true,
    });
  });

  it("rejects a different key after the gateway has already been initialized", () => {
    expect(bootstrapApiKey(candidate)).toMatchObject({ success: true });

    expect(bootstrapApiKey(`wa_${"c".repeat(64)}`)).toEqual({
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app is already initialized. Use the existing API key or auth cookie.",
    });
  });
});
