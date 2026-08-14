import { Router } from "express";
import { recordActivity } from "../../activity/store.js";
import { isApplicationError } from "../../errors/application-error.js";
import { asyncHandler } from "../../http/middleware/async-handler.js";
import { requireApiKey } from "../../http/middleware/auth.js";
import { createRateLimit } from "../../http/middleware/rate-limit.js";
import { isOutboundPolicyError } from "../../policy/outbound-policy.js";
import { messageService } from "./message.service.js";

export const messageRouter = Router();

messageRouter.post(
  "/send",
  requireApiKey,
  createRateLimit({ limit: 30, windowMs: 60_000 }),
  asyncHandler(async (req, res, next) => {
    const {
      to,
      text,
      idempotencyKey: bodyIdempotencyKey,
    } = req.body as {
      to?: unknown;
      text?: unknown;
      idempotencyKey?: unknown;
    };

    if (typeof to !== "string" || typeof text !== "string" || !to.trim() || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "to and text are required",
      });
    }

    try {
      const headerIdempotencyKey = req.header("idempotency-key")?.trim();
      const idempotencyKey =
        headerIdempotencyKey ||
        (typeof bodyIdempotencyKey === "string" && bodyIdempotencyKey.trim() ? bodyIdempotencyKey.trim() : undefined);
      const result = await messageService.send({ to, text, idempotencyKey });

      return res.status(202).json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (isOutboundPolicyError(error)) {
        void recordActivity({
          level: "warning",
          category: "messaging",
          code: "message.policy_blocked",
          title: "Message blocked by policy",
          description: error.message,
          metadata: {
            targetPhone: to,
            reason: error.code,
            retryAt: error.retryAt?.toISOString(),
          },
        });
      } else if (isApplicationError(error)) {
        if (error.code === "WHATSAPP_NOT_CONNECTED") {
          void recordActivity({
            level: "warning",
            category: "messaging",
            code: "message.not_connected",
            title: "Message could not be sent",
            description: "WhatsApp is not connected. Reconnect the session before sending again.",
            metadata: { targetPhone: to },
          });
        } else if (error.code === "PHONE_NOT_ON_WHATSAPP") {
          void recordActivity({
            level: "warning",
            category: "messaging",
            code: "message.phone_not_registered",
            title: "Recipient not found on WhatsApp",
            description: "WhatsApp reported that the destination number is not registered.",
            metadata: { targetPhone: to },
          });
        } else if (error.code === "REACHOUT_RESTRICTED") {
          void recordActivity({
            level: "warning",
            category: "messaging",
            code: "message.reachout_restricted",
            title: "WhatsApp blocked this reach-out",
            description: "WhatsApp temporarily rejected this destination as a restricted outbound reach-out.",
            metadata: { targetPhone: to },
          });
        }
      }

      if (isApplicationError(error)) {
        return next(error);
      }

      void recordActivity({
        level: "error",
        category: "messaging",
        code: "message.send_failed",
        title: "Message send failed",
        description: "The gateway encountered an unexpected error while sending the message.",
        metadata: { targetPhone: to },
      });

      return res.status(500).json({
        success: false,
        error: "SEND_MESSAGE_FAILED",
        message: "Failed to send WhatsApp message",
      });
    }
  }),
);

messageRouter.get("/:id/status", requireApiKey, (req, res) => {
  const messageId = req.params.id;

  if (typeof messageId !== "string") {
    return res.status(400).json({
      success: false,
      error: "INVALID_MESSAGE_ID",
      message: "Message id is required",
    });
  }

  const result = messageService.findStatus(messageId);

  if (!result) {
    return res.status(404).json({
      success: false,
      error: "MESSAGE_STATUS_NOT_FOUND",
      message: "Message status was not found or has expired",
    });
  }

  return res.json({
    success: true,
    ...result,
  });
});
