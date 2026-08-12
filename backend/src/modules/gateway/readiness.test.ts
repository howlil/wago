import { beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config/index.js";
import { getReadinessSnapshot } from "./readiness.js";

describe("gateway readiness", () => {
  beforeEach(() => {
    config.apiKey = null;
    config.apiKeyHash = null;
    config.apiKeySource = "unset";
  });

  it("derives the public readiness shape from credential and webhook state", () => {
    expect(getReadinessSnapshot()).toEqual({
      status: "ok",
      appId: config.appId,
      apiKeyConfigured: false,
      webhookConfigured: config.deliveryWebhookEnabled,
    });

    config.apiKey = "configured";
    config.apiKeySource = "env";

    expect(getReadinessSnapshot()).toEqual({
      status: "ok",
      appId: config.appId,
      apiKeyConfigured: true,
      webhookConfigured: config.deliveryWebhookEnabled,
    });
  });
});
