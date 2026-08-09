import { describe, expect, it } from "vitest";
import { validateRuntimeConfig } from "./validation.js";

const secureProductionConfig = {
  nodeEnv: "production",
  allowWebBootstrap: false,
  apiKeyConfigured: true,
  authCookieSecure: true,
  corsOrigin: "https://app.example.com",
};

describe("validateRuntimeConfig", () => {
  it("does not block development defaults", () => {
    expect(
      validateRuntimeConfig({
        nodeEnv: "development",
        allowWebBootstrap: true,
        apiKeyConfigured: false,
        authCookieSecure: false,
        corsOrigin: "*",
      }),
    ).toEqual([]);
  });

  it("accepts deliberate production security settings", () => {
    expect(validateRuntimeConfig(secureProductionConfig)).toEqual([]);
  });

  it("fails closed for unsafe production settings", () => {
    expect(
      validateRuntimeConfig({
        nodeEnv: "production",
        allowWebBootstrap: true,
        apiKeyConfigured: false,
        authCookieSecure: false,
        corsOrigin: "*",
      }),
    ).toEqual([
      "ALLOW_WEB_BOOTSTRAP must be false in production.",
      "API_KEY must be set or the app must already have a generated key in production.",
      "AUTH_COOKIE_SECURE must be true in production.",
      "CORS_ORIGIN must not be * in production.",
    ]);
  });
});
