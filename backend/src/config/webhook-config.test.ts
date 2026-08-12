import { describe, expect, it } from "vitest";
import { parseDeliveryWebhookConfig } from "./webhook-config.js";

describe("delivery webhook config", () => {
  it("allows webhook delivery to remain disabled", () => {
    expect(parseDeliveryWebhookConfig({})).toEqual({
      enabled: false,
      url: null,
      secret: null,
      previousSecret: null,
    });
  });

  it("requires URL and current secret together", () => {
    expect(() => parseDeliveryWebhookConfig({ WEBHOOK_URL: "https://example.test/webhook" })).toThrow(
      "WEBHOOK_URL and WEBHOOK_SECRET must be configured together",
    );
    expect(() => parseDeliveryWebhookConfig({ WEBHOOK_SECRET: "a".repeat(32) })).toThrow(
      "WEBHOOK_URL and WEBHOOK_SECRET must be configured together",
    );
  });

  it("requires high-entropy-length signing secrets", () => {
    expect(() =>
      parseDeliveryWebhookConfig({
        WEBHOOK_URL: "https://example.test/webhook",
        WEBHOOK_SECRET: "too-short",
      }),
    ).toThrow("WEBHOOK_SECRET must contain at least 32 characters");
  });

  it("accepts an optional previous secret for rotation", () => {
    expect(
      parseDeliveryWebhookConfig({
        WEBHOOK_URL: "https://example.test/webhook",
        WEBHOOK_SECRET: "a".repeat(32),
        WEBHOOK_SECRET_PREVIOUS: "b".repeat(32),
      }),
    ).toEqual({
      enabled: true,
      url: "https://example.test/webhook",
      secret: "a".repeat(32),
      previousSecret: "b".repeat(32),
    });
  });

  it("rejects unsupported URL schemes and embedded credentials", () => {
    expect(() =>
      parseDeliveryWebhookConfig({
        WEBHOOK_URL: "ftp://example.test/webhook",
        WEBHOOK_SECRET: "a".repeat(32),
      }),
    ).toThrow("WEBHOOK_URL must use http or https");

    expect(() =>
      parseDeliveryWebhookConfig({
        WEBHOOK_URL: "https://user:pass@example.test/webhook",
        WEBHOOK_SECRET: "a".repeat(32),
      }),
    ).toThrow("WEBHOOK_URL must not contain embedded credentials");
  });
});
