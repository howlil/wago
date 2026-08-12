import { config } from "../../config/index.js";
import { getDatabase } from "../../infrastructure/database.js";
import { createWebhookSettingsStore } from "../../webhooks/settings-store.js";

export type ReadinessSnapshot = {
  status: "ok";
  appId: string;
  apiKeyConfigured: boolean;
  webhookConfigured: boolean;
};

const webhookSettingsStore = createWebhookSettingsStore(getDatabase());

export function getReadinessSnapshot(): ReadinessSnapshot {
  const webhookSettings = webhookSettingsStore.get();
  return {
    status: "ok",
    appId: config.appId,
    apiKeyConfigured: Boolean(config.apiKey || config.apiKeyHash),
    webhookConfigured: Boolean(webhookSettings?.enabled && webhookSettings.url && webhookSettings.secret),
  };
}
