import { describe, expect, it } from "vitest";
import { validateRuntimeConfig } from "./validation.js";

const validProductionConfig = {
  nodeEnv: "production",
  corsOrigin: "https://app.example.com",
};

describe("validateRuntimeConfig", () => {
  it("does not block development defaults", () => {
    expect(
      validateRuntimeConfig({
        nodeEnv: "development",
        corsOrigin: "*",
      }),
    ).toEqual([]);
  });

  it("accepts production with first-run API key setup", () => {
    expect(validateRuntimeConfig(validProductionConfig)).toEqual([]);
  });

  it("still requires an explicit production browser origin", () => {
    expect(
      validateRuntimeConfig({
        nodeEnv: "production",
        corsOrigin: "*",
      }),
    ).toEqual(["CORS_ORIGIN is required in production and must not be *."]);
  });
});
