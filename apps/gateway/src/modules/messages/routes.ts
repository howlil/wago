import { randomUUID } from "node:crypto";
import { Router, raw } from "express";
import { isApplicationError } from "../../errors/application-error.js";
import { asyncHandler } from "../../http/middleware/async-handler.js";
import { requireAuthenticatedRequest } from "../../http/middleware/auth.js";
import { createRateLimit } from "../../http/middleware/rate-limit.js";
import { recordActivity } from "../activity/store.js";
import type { PublicWebhookDelivery } from "../webhooks/index.js";
import type { StoredMessageStatus } from "./message-status-store.js";
import { isOutboundPolicyError } from "./outbound-policy.js";

export type MessageMediaKind = "image" | "video" | "audio" | "document";

type MessageSendOptions = {
  idempotencyKey?: string;
  messageId: string;
  replyToMessageId?: string;
};

type MessageSendResult = {
  messageId: string;
  status: "pending";
};

type MessageMediaInput = {
  kind: MessageMediaKind;
  data: Buffer;
  mimetype: string;
  caption?: string;
  fileName?: string;
};

type DownloadedInboundMedia = {
  data: Buffer;
  media: {
    kind: MessageMediaKind;
    mimetype?: string;
    fileName?: string;
    fileLength?: number;
    caption?: string;
    seconds?: number;
    width?: number;
    height?: number;
  };
};

export type MessageRouteDependencies = {
  sendText: (to: string, text: string, options: MessageSendOptions) => Promise<MessageSendResult>;
  sendMedia: (to: string, media: MessageMediaInput, options: MessageSendOptions) => Promise<MessageSendResult>;
  downloadInboundMedia: (messageId: string) => Promise<DownloadedInboundMedia>;
  getStatus: (messageId: string) => StoredMessageStatus | null | undefined;
  getWebhookDelivery?: (messageId: string) => PublicWebhookDelivery | null;
  createMessageId?: () => string;
};

const mediaKinds = new Set<MessageMediaKind>(["image", "video", "audio", "document"]);

function readMessageId(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.trim().length <= 128 ? value.trim() : null;
}

function readOptionalMessageId(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  return readMessageId(value);
}

function mediaKind(value: string | undefined): MessageMediaKind | null {
  const normalized = value?.trim().toLowerCase() as MessageMediaKind | undefined;
  return normalized && mediaKinds.has(normalized) ? normalized : null;
}

function mediaContentTypeAllowed(kind: MessageMediaKind, mimetype: string): boolean {
  const base = mimetype.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!base || base === "application/json") return false;
  if (kind === "image") return base.startsWith("image/");
  if (kind === "video") return base.startsWith("video/");
  if (kind === "audio") return base.startsWith("audio/");
  return true;
}

function safeDownloadFileName(value: string): string {
  return value.replace(/[\\"\r\n]/g, "_").slice(0, 255) || "attachment";
}

function optionalStatusFields(status: StoredMessageStatus) {
  return {
    ...(status.deliveryEvidence !== undefined ? { deliveryEvidence: status.deliveryEvidence } : {}),
    ...(status.error !== undefined ? { error: status.error } : {}),
    ...(status.message !== undefined ? { message: status.message } : {}),
    ...(status.acceptedAt !== undefined ? { acceptedAt: status.acceptedAt } : {}),
    ...(status.rejectedAt !== undefined ? { rejectedAt: status.rejectedAt } : {}),
    ...(status.serverAcceptedAt !== undefined ? { serverAcceptedAt: status.serverAcceptedAt } : {}),
    ...(status.deliveredAt !== undefined ? { deliveredAt: status.deliveredAt } : {}),
    ...(status.readAt !== undefined ? { readAt: status.readAt } : {}),
    ...(status.playedAt !== undefined ? { playedAt: status.playedAt } : {}),
  };
}

function publicMessageStatus(status: StoredMessageStatus) {
  return {
    id: status.id,
    to: status.to,
    status: status.status,
    createdAt: status.createdAt,
    updatedAt: status.updatedAt,
    ...optionalStatusFields(status),
  };
}

function messageDiagnostic(status: StoredMessageStatus, webhook: PublicWebhookDelivery | null) {
  return {
    id: status.id,
    status: status.status,
    createdAt: status.createdAt,
    updatedAt: status.updatedAt,
    ...optionalStatusFields(status),
    dispatchState: status.dispatchState,
    webhook,
  };
}

function recordSendFailure(error: unknown, to: string): void {
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
    return;
  }

  if (isApplicationError(error)) {
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
    } else if (error.code === "MESSAGE_CONTEXT_UNAVAILABLE") {
      void recordActivity({
        level: "warning",
        category: "messaging",
        code: "message.context_unavailable",
        title: "Reply context unavailable",
        description: "The requested quoted message is unavailable, expired, or belongs to another recipient.",
        metadata: { targetPhone: to },
      });
    }
    return;
  }

  void recordActivity({
    level: "error",
    category: "messaging",
    code: "message.send_failed",
    title: "Message send failed",
    description: "The gateway encountered an unexpected error while sending the message.",
    metadata: { targetPhone: to },
  });
}

export function createMessageRouter(deps: MessageRouteDependencies) {
  const messageRouter = Router();
  const createMessageId = deps.createMessageId ?? randomUUID;

  messageRouter.post(
    "/send",
    requireAuthenticatedRequest,
    createRateLimit({ limit: 30, windowMs: 60_000 }),
    asyncHandler(async (req, res, next) => {
      const {
        to,
        text,
        idempotencyKey: bodyIdempotencyKey,
        replyToMessageId: bodyReplyToMessageId,
      } = req.body as {
        to?: unknown;
        text?: unknown;
        idempotencyKey?: unknown;
        replyToMessageId?: unknown;
      };

      if (typeof to !== "string" || typeof text !== "string" || !to.trim() || !text.trim()) {
        return res.status(400).json({
          success: false,
          error: "INVALID_REQUEST",
          message: "to and text are required",
        });
      }

      const replyToMessageId = readOptionalMessageId(bodyReplyToMessageId);
      if (replyToMessageId === null) {
        return res.status(400).json({
          success: false,
          error: "INVALID_REQUEST",
          message: "replyToMessageId must be a non-empty message id of at most 128 characters",
        });
      }

      try {
        const headerIdempotencyKey = req.header("idempotency-key")?.trim();
        const idempotencyKey =
          headerIdempotencyKey ||
          (typeof bodyIdempotencyKey === "string" && bodyIdempotencyKey.trim() ? bodyIdempotencyKey.trim() : undefined);
        const result = await deps.sendText(to, text, {
          ...(idempotencyKey ? { idempotencyKey } : {}),
          messageId: createMessageId(),
          ...(replyToMessageId ? { replyToMessageId } : {}),
        });

        return res.status(202).json({ success: true, ...result });
      } catch (error) {
        recordSendFailure(error, to);
        return next(error);
      }
    }),
  );

  messageRouter.post(
    "/send-media",
    requireAuthenticatedRequest,
    createRateLimit({ limit: 30, windowMs: 60_000 }),
    raw({ type: () => true, limit: "8mb" }),
    asyncHandler(async (req, res, next) => {
      const to = req.header("x-wago-to")?.trim();
      const kind = mediaKind(req.header("x-wago-media-kind"));
      const mimetype = req.header("content-type")?.trim();
      const replyHeader = req.header("x-wago-reply-to");
      const replyToMessageId = readOptionalMessageId(replyHeader);
      const caption = req.header("x-wago-caption")?.trim();
      const fileName = req.header("x-wago-filename")?.trim();

      if (!to || !kind || !mimetype || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({
          success: false,
          error: "INVALID_REQUEST",
          message: "X-Wago-To, X-Wago-Media-Kind, Content-Type, and a non-empty binary body are required",
        });
      }
      if (!mediaContentTypeAllowed(kind, mimetype)) {
        return res.status(400).json({
          success: false,
          error: "INVALID_REQUEST",
          message: `Content-Type is not valid for ${kind} media`,
        });
      }
      if (replyToMessageId === null) {
        return res.status(400).json({
          success: false,
          error: "INVALID_REQUEST",
          message: "X-Wago-Reply-To must be a non-empty message id of at most 128 characters",
        });
      }
      if (caption && caption.length > 4096) {
        return res.status(400).json({ success: false, error: "INVALID_REQUEST", message: "Caption is too long" });
      }
      if (fileName && fileName.length > 255) {
        return res.status(400).json({ success: false, error: "INVALID_REQUEST", message: "Filename is too long" });
      }

      try {
        const idempotencyKey = req.header("idempotency-key")?.trim();
        const result = await deps.sendMedia(
          to,
          {
            kind,
            data: req.body,
            mimetype,
            ...(caption ? { caption } : {}),
            ...(fileName ? { fileName } : {}),
          },
          {
            ...(idempotencyKey ? { idempotencyKey } : {}),
            messageId: createMessageId(),
            ...(replyToMessageId ? { replyToMessageId } : {}),
          },
        );
        return res.status(202).json({ success: true, ...result });
      } catch (error) {
        recordSendFailure(error, to);
        return next(error);
      }
    }),
  );

  messageRouter.get(
    "/incoming/:id/media",
    requireAuthenticatedRequest,
    asyncHandler(async (req, res, next) => {
      const messageId = readMessageId(req.params.id);
      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: "INVALID_MESSAGE_ID",
          message: "Message id is required",
        });
      }

      try {
        const result = await deps.downloadInboundMedia(messageId);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", result.media.mimetype ?? "application/octet-stream");
        res.setHeader("Content-Length", result.data.length.toString());
        if (result.media.fileName) {
          res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadFileName(result.media.fileName)}"`);
        }
        return res.send(result.data);
      } catch (error) {
        return next(error);
      }
    }),
  );

  messageRouter.get("/:id/status", requireAuthenticatedRequest, (req, res) => {
    const messageId = readMessageId(req.params.id);
    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_MESSAGE_ID",
        message: "Message id is required",
      });
    }

    const status = deps.getStatus(messageId);
    if (!status) {
      return res.status(404).json({
        success: false,
        error: "MESSAGE_STATUS_NOT_FOUND",
        message: "Message status was not found or has expired",
      });
    }

    return res.json({ success: true, ...publicMessageStatus(status) });
  });

  messageRouter.get("/:id", requireAuthenticatedRequest, (req, res) => {
    const messageId = readMessageId(req.params.id);
    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_MESSAGE_ID",
        message: "Message id is required",
      });
    }

    const status = deps.getStatus(messageId);
    if (!status) {
      return res.status(404).json({
        success: false,
        error: "MESSAGE_NOT_FOUND",
        message: "Message diagnostics were not found or are outside the retained diagnostics window",
      });
    }

    return res.json({
      success: true,
      ...messageDiagnostic(status, deps.getWebhookDelivery?.(messageId) ?? null),
    });
  });

  return messageRouter;
}
