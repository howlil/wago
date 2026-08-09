import { describe, expect, it } from "vitest";
import { validateRuntimeConfig } from "./validation.js";

const validProductionConfig = {
  nodeEnv: "production",
  apiKeyConfigured: true,
  corsOrigin: "https://app.example.com",
};

describe("validateRuntimeConfig", () => {
  it("does not block development defaults", () => {
    expect(
      validateRuntimeConfig({
        nodeEnv: "development",
        apiKeyConfigured: false,
        corsOrigin: "*",
      }),
    ).toEqual([]);
  });

  it("accepts the two required production settings", () => {
    expect(validateRuntimeConfig(validProductionConfig)).toEqual([]);
  });

  it("fails closed when either production setting is missing", () => {
    expect(
      validateRuntimeConfig({
        nodeEnv: "production",
        apiKeyConfigured: false,
        corsOrigin: "*",
      }),
    ).toEqual(["API_KEY is required in production.", "CORS_ORIGIN is required in production and must not be *."]);
  });
});
