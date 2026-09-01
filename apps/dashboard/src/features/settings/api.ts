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

export type WebhookDeliveryStatus = "pending" | "delivering" | "delivered" | "failed" | "expired";
export type WebhookAttemptOutcome =
  | "in_progress"
  | "succeeded"
  | "retryable_failure"
  | "permanent_failure"
  | "interrupted";

export type WebhookDelivery = {
  id: string;
  event: string;
  messageId: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  redeliveryCount: number;
  nextAttemptAt: string | null;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  lastStatusCode: number | null;
  lastErrorCode: string | null;
  createdAt: string;
  deliveredAt: string | null;
  expiresAt: string;
  claimedAt: string | null;
  redeliveryAvailable: boolean;
};

export type WebhookDeliveryAttempt = {
  sequence: number;
  redeliveryNumber: number;
  outcome: WebhookAttemptOutcome;
  startedAt: string;
  completedAt: string | null;
  statusCode: number | null;
  errorCode: string | null;
  retryable: boolean | null;
  nextAttemptAt: string | null;
};

export type WebhookDeliveryDetail = WebhookDelivery & {
  attempts: WebhookDeliveryAttempt[];
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
