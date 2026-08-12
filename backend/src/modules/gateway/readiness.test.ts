import { beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config/index.js";
import { getDatabase } from "../../infrastructure/database.js";
import { createWebhookSettingsStore } from "../../webhooks/settings-store.js";
import { getReadinessSnapshot } from "./readiness.js";

const webhookSettingsStore = createWebhookSettingsStore(getDatabase());

describe("gateway readiness", () => {
  beforeEach(() => {
    config.apiKey = null;
    config.apiKeyHash = null;
    config.apiKeySource = "unset";
    webhookSettingsStore.clear();
  });

  it("derives the public readiness shape from credential and persisted webhook state", () => {
    expect(getReadinessSnapshot()).toEqual({
      status: "ok",
      appId: config.appId,
      apiKeyConfigured: false,
      webhookConfigured: false,
    });

    config.apiKey = "configured";
    config.apiKeySource = "env";
    webhookSettingsStore.save({ enabled: true, url: "https://receiver.example.test/webhook" });

    expect(getReadinessSnapshot()).toEqual({
      status: "ok",
      appId: config.appId,
      apiKeyConfigured: true,
      webhookConfigured: true,
    });
  });
});
