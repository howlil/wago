import { config } from "../../config/index.js";

export type ReadinessSnapshot = {
  status: "ok";
  appId: string;
  apiKeyConfigured: boolean;
};

export function getReadinessSnapshot(): ReadinessSnapshot {
  return {
    status: "ok",
    appId: config.appId,
    apiKeyConfigured: Boolean(config.apiKey || config.apiKeyHash),
  };
}
