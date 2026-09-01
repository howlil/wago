import { Router } from "express";
import QRCode from "qrcode";
import { asyncHandler } from "../../http/middleware/async-handler.js";
import { requireAuthenticatedRequest } from "../../http/middleware/auth.js";
import { createRateLimit } from "../../http/middleware/rate-limit.js";
import { recordActivity } from "../activity/store.js";
import { getCurrentQr, getWhatsAppStatus, pairWhatsApp, rebindWhatsApp } from "./index.js";

export const whatsappRouter = Router();

whatsappRouter.get("/status", requireAuthenticatedRequest, (_req, res) => {
  res.json({
    success: true,
    ...getWhatsAppStatus(),
  });
});

whatsappRouter.get("/qr", requireAuthenticatedRequest, (_req, res) => {
  res.json({
    success: true,
    ...getCurrentQr(),
  });
});

whatsappRouter.get(
  "/qr/image",
  requireAuthenticatedRequest,
  asyncHandler(async (_req, res) => {
    const { qr } = getCurrentQr();

    if (!qr) {
      return res.status(404).json({
        success: false,
        error: "QR_NOT_AVAILABLE",
        message: "QR is not available",
      });
    }

    const svg = await QRCode.toString(qr, {
      type: "svg",
      margin: 2,
      width: 320,
    });

    return res.type("image/svg+xml").send(svg);
  }),
);

whatsappRouter.post(
  "/pair",
  requireAuthenticatedRequest,
  createRateLimit({ limit: 5, windowMs: 60_000 }),
  asyncHandler(async (_req, res, next) => {
    try {
      const before = getWhatsAppStatus();
      const result = await pairWhatsApp();

      if (before.binding.state === "unbound") {
        void recordActivity({
          level: "info",
          category: "connection",
          code: "whatsapp.pairing.started",
          title: "Pairing started",
          description: "A WhatsApp linking session was started. Scan the QR code when it becomes available.",
        });
      }

      return res.json({
        success: true,
        message:
          before.binding.state === "bound"
            ? "This gateway is already bound to its WhatsApp account."
            : result.status === "qr"
              ? "WhatsApp QR is ready to scan."
              : "WhatsApp pairing started.",
        ...result,
      });
    } catch (error) {
      void recordActivity({
        level: "error",
        category: "connection",
        code: "whatsapp.pairing.failed",
        title: "Pairing failed",
        description: "The gateway could not start a WhatsApp pairing session.",
      });

      return next(error);
    }
  }),
);

whatsappRouter.post(
  "/rebind",
  requireAuthenticatedRequest,
  createRateLimit({ limit: 5, windowMs: 60_000 }),
  asyncHandler(async (_req, res, next) => {
    try {
      const result = await rebindWhatsApp();

      void recordActivity({
        level: "warning",
        category: "connection",
        code: "whatsapp.rebind.started",
        title: "Account change started",
        description: "The previous WhatsApp session was cleared. A new account must be linked with QR pairing.",
      });

      return res.json({
        success: true,
        message: "Previous WhatsApp binding was cleared. Scan the new QR to bind another account.",
        ...result,
      });
    } catch (error) {
      void recordActivity({
        level: "error",
        category: "connection",
        code: "whatsapp.rebind.failed",
        title: "Account change failed",
        description: "The gateway could not clear and restart the WhatsApp session.",
      });

      return next(error);
    }
  }),
);
