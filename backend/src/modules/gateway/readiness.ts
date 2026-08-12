import { config } from "../../config/index.js";

export type ReadinessSnapshot = {
  status: "ok";
  appId: string;
  apiKeyConfigured: boolean;
  webhookConfigured: boolean;
};

export function getReadinessSnapshot(): ReadinessSnapshot {
  return {
    status: "ok",
    appId: config.appId,
    apiKeyConfigured: Boolean(config.apiKey || config.apiKeyHash),
    webhookConfigured: config.deliveryWebhookEnabled,
  };
}
