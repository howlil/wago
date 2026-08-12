import { Router } from "express";
import { requireApiKey } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import type { WebhookDeliveryStatus } from "../webhooks/delivery-store.js";
import { getWebhookDelivery, listWebhookDeliveries, redeliverWebhookDelivery } from "../webhooks/delivery-webhook.js";

export const webhookRouter = Router();

const WEBHOOK_STATUSES = new Set<WebhookDeliveryStatus>(["pending", "delivering", "delivered", "failed", "expired"]);
const WEBHOOK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const redeliveryRateLimit = createRateLimit({ limit: 20, windowMs: 60_000 });

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function deliveryIdFromParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function hasValidDeliveryId(value: string): boolean {
  return WEBHOOK_ID_PATTERN.test(value);
}

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
      message: "Configure WEBHOOK_URL and WEBHOOK_SECRET before redelivering callbacks",
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
