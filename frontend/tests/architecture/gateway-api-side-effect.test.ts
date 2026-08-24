import { afterEach, describe, expect, it, vi } from "vitest";

const legacyApiKeyStorageKey = "wago.apiKey";

afterEach(() => {
  window.sessionStorage.clear();
  vi.resetModules();
});

describe("gateway API module side effects", () => {
  it("keeps API imports passive and exposes legacy session cleanup explicitly", async () => {
    window.sessionStorage.setItem(legacyApiKeyStorageKey, "wa_legacy");

    await import("../../src/features/gateway/api.js");

    expect(window.sessionStorage.getItem(legacyApiKeyStorageKey)).toBe("wa_legacy");

    const { clearLegacyApiKeySessionStorage } = await import("../../src/features/gateway/legacy-session.js");
    clearLegacyApiKeySessionStorage();

    expect(window.sessionStorage.getItem(legacyApiKeyStorageKey)).toBeNull();
  });
});
