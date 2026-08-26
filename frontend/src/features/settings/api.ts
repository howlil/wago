import { requestJson } from "../../shared/api/client.js";

export type WebhookSettingsResponse = {
  success: true;
  enabled: boolean;
  url: string | null;
  secretConfigured: boolean;
  rotationPending: boolean;
  updatedAt: string | null;
  generatedSecret?: string;
};

export type WebhookTestDelivery = {
  id: string;
  event: "wago.test";
  status: "pending" | "delivering" | "delivered" | "failed" | "expired";
  lastStatusCode: number | null;
  lastErrorCode: string | null;
};

export type WebhookTestResponse = {
  success: true;
  delivery: WebhookTestDelivery;
};

export function getWebhookSettings(): Promise<WebhookSettingsResponse> {
  return requestJson<WebhookSettingsResponse>("/webhooks/settings");
}

export function updateWebhookSettings(input: {
  enabled: boolean;
  url: string | null;
}): Promise<WebhookSettingsResponse> {
  return requestJson<WebhookSettingsResponse>("/webhooks/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function rotateWebhookSecret(): Promise<WebhookSettingsResponse> {
  return requestJson<WebhookSettingsResponse>("/webhooks/settings/rotate-secret", { method: "POST" });
}

export function completeWebhookSecretRotation(): Promise<WebhookSettingsResponse> {
  return requestJson<WebhookSettingsResponse>("/webhooks/settings/complete-rotation", { method: "POST" });
}

export function sendWebhookTest(): Promise<WebhookTestResponse> {
  return requestJson<WebhookTestResponse>("/webhooks/test", { method: "POST" });
}
