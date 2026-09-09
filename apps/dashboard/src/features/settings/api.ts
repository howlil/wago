import type {
  WebhookAttemptOutcome,
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookDeliveryDetail,
  WebhookDeliveryStatus,
} from "@wago/contracts";
import { requestJson } from "../../shared/api/client.js";

export type {
  WebhookAttemptOutcome,
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookDeliveryDetail,
  WebhookDeliveryStatus,
};

export type WebhookSettingsResponse = {
  success: true;
  enabled: boolean;
  url: string | null;
  secretConfigured: boolean;
  rotationPending: boolean;
  updatedAt: string | null;
  generatedSecret?: string;
};

export type WebhookTestDelivery = Pick<
  WebhookDelivery,
  "id" | "event" | "status" | "lastStatusCode" | "lastErrorCode"
> & {
  event: "wago.test";
};

export type WebhookTestResponse = {
  success: true;
  delivery: WebhookTestDelivery;
};

export type WebhookDeliveriesResponse = {
  success: true;
  deliveries: WebhookDelivery[];
};

export type WebhookDeliveryDetailResponse = {
  success: true;
  delivery: WebhookDeliveryDetail;
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

export function getWebhookDeliveries(limit = 10): Promise<WebhookDeliveriesResponse> {
  return requestJson<WebhookDeliveriesResponse>(`/webhooks/deliveries?limit=${limit}`);
}

export function getWebhookDelivery(id: string): Promise<WebhookDeliveryDetailResponse> {
  return requestJson<WebhookDeliveryDetailResponse>(`/webhooks/deliveries/${encodeURIComponent(id)}`);
}

export function redeliverWebhookDelivery(id: string): Promise<{ success: true; delivery: WebhookDelivery }> {
  return requestJson<{ success: true; delivery: WebhookDelivery }>(
    `/webhooks/deliveries/${encodeURIComponent(id)}/redeliver`,
    { method: "POST" },
  );
}
