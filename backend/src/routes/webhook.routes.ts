import { Router } from "express";
import { getDatabase } from "../infrastructure/database.js";
import { requireApiKey } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import type { WebhookDeliveryStatus } from "../webhooks/delivery-store.js";
import { getWebhookDelivery, listWebhookDeliveries, redeliverWebhookDelivery } from "../webhooks/delivery-webhook.js";
import { createWebhookSettingsStore, type WebhookSettings } from "../webhooks/settings-store.js";

export const webhookRouter = Router();

const WEBHOOK_STATUSES = new Set<WebhookDeliveryStatus>(["pending", "delivering", "delivered", "failed", "expired"]);
const WEBHOOK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const redeliveryRateLimit = createRateLimit({ limit: 20, windowMs: 60_000 });
const settingsStore = createWebhookSettingsStore(getDatabase());

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function deliveryIdFromParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function hasValidDeliveryId(value: string): boolean {
  return WEBHOOK_ID_PATTERN.test(value);
}

function serializeSettings(settings: WebhookSettings | null) {
  return {
    enabled: settings?.enabled ?? false,
    url: settings?.url ?? null,
    secretConfigured: Boolean(settings?.secret),
    rotationPending: Boolean(settings?.previousSecret),
    updatedAt: settings?.updatedAt ?? null,
  };
}

function settingsError(res: Parameters<Parameters<typeof webhookRouter.put>[2]>[1], error: unknown) {
  return res.status(400).json({
    success: false,
    error: "INVALID_WEBHOOK_SETTINGS",
    message: error instanceof Error ? error.message : "Webhook settings are invalid",
  });
}

webhookRouter.get("/settings", requireApiKey, (_req, res) => {
  return res.json({
    success: true,
    ...serializeSettings(settingsStore.get()),
  });
});

webhookRouter.put("/settings", requireApiKey, (req, res) => {
  const body = req.body as { enabled?: unknown; url?: unknown };
  if (typeof body.enabled !== "boolean" || (body.url !== null && body.url !== undefined && typeof body.url !== "string")) {
    return res.status(400).json({
      success: false,
      error: "INVALID_WEBHOOK_SETTINGS",
      message: "enabled must be a boolean and url must be a string or null",
    });
  }

  try {
    const result = settingsStore.save({ enabled: body.enabled, url: body.url as string | null | undefined });
    return res.json({
      success: true,
      ...serializeSettings(result.settings),
      ...(result.generatedSecret ? { generatedSecret: result.generatedSecret } : {}),
    });
  } catch (error) {
    return settingsError(res, error);
  }
});

webhookRouter.post("/settings/rotate-secret", requireApiKey, (_req, res) => {
  try {
    const result = settingsStore.rotateSecret();
    return res.json({
      success: true,
      ...serializeSettings(result.settings),
      generatedSecret: result.generatedSecret,
    });
  } catch (error) {
    return settingsError(res, error);
  }
});

webhookRouter.post("/settings/complete-rotation", requireApiKey, (_req, res) => {
  try {
    const settings = settingsStore.completeRotation();
    return res.json({
      success: true,
      ...serializeSettings(settings),
    });
  } catch (error) {
    return settingsError(res, error);
  }
});

webhookRouter.get("/deliveries", requireApiKey, (req, res) => {
  const rawStatus = queryString(req.query.status);
  if (rawStatus && !WEBHOOK_STATUSES.has(rawStatus as WebhookDeliveryStatus)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_WEBHOOK_DELIVERY_STATUS",
      message: "Webhook delivery status filter is invalid",
    });
  }

  const requestedLimit = Number(queryString(req.query.limit) ?? 50);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
  const deliveries = listWebhookDeliveries({
    ...(rawStatus ? { status: rawStatus as WebhookDeliveryStatus } : {}),
    limit,
  });

  return res.json({
    success: true,
    deliveries,
  });
});

webhookRouter.get("/deliveries/:id", requireApiKey, (req, res) => {
  const deliveryId = deliveryIdFromParam(req.params.id);
  if (!hasValidDeliveryId(deliveryId)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_WEBHOOK_DELIVERY_ID",
      message: "Webhook delivery ID is invalid",
    });
  }

  const delivery = getWebhookDelivery(deliveryId);
  if (!delivery) {
    return res.status(404).json({
      success: false,
      error: "WEBHOOK_DELIVERY_NOT_FOUND",
      message: "Webhook delivery was not found",
    });
  }

  return res.json({
    success: true,
    delivery,
  });
});

webhookRouter.post("/deliveries/:id/redeliver", requireApiKey, redeliveryRateLimit, (req, res) => {
  const deliveryId = deliveryIdFromParam(req.params.id);
  if (!hasValidDeliveryId(deliveryId)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_WEBHOOK_DELIVERY_ID",
      message: "Webhook delivery ID is invalid",
    });
  }

  const result = redeliverWebhookDelivery(deliveryId);

  if (result.kind === "disabled") {
    return res.status(503).json({
      success: false,
      error: "WEBHOOK_DISABLED",
      message: "Enable webhook delivery in Wago Settings before redelivering callbacks",
    });
  }

  if (result.kind === "not_found") {
    return res.status(404).json({
      success: false,
      error: "WEBHOOK_DELIVERY_NOT_FOUND",
      message: "Webhook delivery was not found",
    });
  }

  if (result.kind === "in_progress") {
    return res.status(409).json({
      success: false,
      error: "WEBHOOK_DELIVERY_IN_PROGRESS",
      message: "Webhook delivery is currently in progress",
    });
  }

  return res.status(202).json({
    success: true,
    delivery: result.delivery,
  });
});
