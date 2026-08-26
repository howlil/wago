import { type RequestHandler, Router } from "express";
import { config } from "../../config/index.js";
import { asyncHandler } from "../../http/middleware/async-handler.js";
import { requireAuthenticatedRequest, requestHasValidBrowserSession } from "../../http/middleware/auth.js";
import { requestHasSameOrigin } from "../../http/middleware/origin.js";
import { createRateLimit } from "../../http/middleware/rate-limit.js";
import { optionalHttpString, requiredHttpString } from "../../http/validation.js";
import { recordActivity } from "../activity/store.js";
import type { WebhookDeliveryStatus } from "./delivery-store.js";
import {
  getWebhookDelivery,
  listWebhookDeliveries,
  redeliverWebhookDelivery,
  sendTestWebhookDelivery,
} from "./delivery-webhook.js";
import { webhookSettingsStore as settingsStore } from "./settings-runtime.js";
import type { WebhookSettings } from "./settings-store.js";

export const webhookRouter = Router();

const WEBHOOK_STATUSES = new Set<WebhookDeliveryStatus>(["pending", "delivering", "delivered", "failed", "expired"]);
const WEBHOOK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_WEBHOOK_DELIVERY_LIMIT = 1;
const MAX_WEBHOOK_DELIVERY_LIMIT = 100;
const redeliveryRateLimit = createRateLimit({ limit: 20, windowMs: 60_000 });
const webhookTestRateLimit = createRateLimit({ limit: 5, windowMs: 60_000 });

const requireBrowserSession: RequestHandler = (req, res, next) => {
  if (!requestHasValidBrowserSession(req)) {
    return res.status(401).json({
      success: false,
      error: "BROWSER_SESSION_REQUIRED",
      message: "Webhook tests require an authenticated Wago dashboard session",
    });
  }
  return next();
};

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

webhookRouter.get("/settings", requireAuthenticatedRequest, (_req, res) => {
  return res.json({ success: true, ...serializeSettings(settingsStore.get()) });
});

webhookRouter.put("/settings", requireAuthenticatedRequest, (req, res, next) => {
  const body = req.body as { enabled?: unknown; url?: unknown };
  if (
    typeof body.enabled !== "boolean" ||
    (body.url !== null && body.url !== undefined && typeof body.url !== "string")
  ) {
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
    return next(error);
  }
});

webhookRouter.post("/settings/rotate-secret", requireAuthenticatedRequest, (_req, res, next) => {
  try {
    const result = settingsStore.rotateSecret();
    return res.json({
      success: true,
      ...serializeSettings(result.settings),
      generatedSecret: result.generatedSecret,
    });
  } catch (error) {
    return next(error);
  }
});

webhookRouter.post("/settings/complete-rotation", requireAuthenticatedRequest, (_req, res, next) => {
  try {
    const settings = settingsStore.completeRotation();
    return res.json({ success: true, ...serializeSettings(settings) });
  } catch (error) {
    return next(error);
  }
});

webhookRouter.post(
  "/test",
  requireBrowserSession,
  webhookTestRateLimit,
  asyncHandler(async (req, res) => {
    if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
      return res.status(403).json({
        success: false,
        error: "INVALID_WEBHOOK_TEST_ORIGIN",
        message: "Webhook tests must come from the Wago dashboard origin",
      });
    }

    const result = await sendTestWebhookDelivery();
    if (result.kind === "disabled") {
      return res.status(503).json({
        success: false,
        error: "WEBHOOK_DISABLED",
        message: "Enable and save webhook delivery before sending a test callback",
      });
    }

    void recordActivity({
      level: "info",
      category: "webhook",
      code: "webhook.test_requested",
      title: "Webhook test requested",
      description: "An authenticated dashboard operator queued a signed test webhook through the production delivery path.",
      metadata: { deliveryId: result.delivery.id, status: result.delivery.status },
    });

    return res.status(202).json({ success: true, delivery: result.delivery });
  }),
);

webhookRouter.get("/deliveries", requireAuthenticatedRequest, (req, res) => {
  const rawStatus = optionalHttpString(req.query.status);
  if (rawStatus && !WEBHOOK_STATUSES.has(rawStatus as WebhookDeliveryStatus)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_WEBHOOK_DELIVERY_STATUS",
      message: "Webhook delivery status filter is invalid",
    });
  }

  const requestedLimit = Number(optionalHttpString(req.query.limit) ?? 50);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
  if (limit < MIN_WEBHOOK_DELIVERY_LIMIT || limit > MAX_WEBHOOK_DELIVERY_LIMIT) {
    return res.status(400).json({
      success: false,
      error: "INVALID_WEBHOOK_DELIVERY_LIMIT",
      message: "Webhook delivery limit must be between 1 and 100",
    });
  }

  const deliveries = listWebhookDeliveries({
    ...(rawStatus ? { status: rawStatus as WebhookDeliveryStatus } : {}),
    limit,
  });

  return res.json({ success: true, deliveries });
});

webhookRouter.get("/deliveries/:id", requireAuthenticatedRequest, (req, res) => {
  const deliveryId = requiredHttpString(req.params.id);
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

  return res.json({ success: true, delivery });
});

webhookRouter.post("/deliveries/:id/redeliver", requireAuthenticatedRequest, redeliveryRateLimit, (req, res) => {
  const deliveryId = requiredHttpString(req.params.id);
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

  return res.status(202).json({ success: true, delivery: result.delivery });
});
