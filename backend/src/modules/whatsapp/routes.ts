import { Router } from "express";
import QRCode from "qrcode";
import { asyncHandler } from "../../http/middleware/async-handler.js";
import { requireApiKey } from "../../http/middleware/auth.js";
import { createRateLimit } from "../../http/middleware/rate-limit.js";
import { recordActivity } from "../activity/store.js";
import { getCurrentQr, getWhatsAppStatus, pairWhatsApp, rebindWhatsApp } from "./index.js";

export const whatsappRouter = Router();

whatsappRouter.get("/status", requireApiKey, (_req, res) => {
  res.json({
    success: true,
    ...getWhatsAppStatus(),
  });
});

whatsappRouter.get("/qr", requireApiKey, (_req, res) => {
  res.json({
    success: true,
    ...getCurrentQr(),
  });
});

whatsappRouter.get(
  "/qr/image",
  requireApiKey,
  asyncHandler(async (_req, res) => {
    const { qr, status } = getCurrentQr();

    if (!qr) {
      return res.status(status === "connected" ? 200 : 404).json({
        success: status === "connected",
        qr: null,
        status,
        message: status === "connected" ? "WhatsApp is already connected" : "QR is not available",
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
  requireApiKey,
  createRateLimit({ limit: 5, windowMs: 60_000 }),
  asyncHandler(async (_req, res) => {
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
    } catch {
      void recordActivity({
        level: "error",
        category: "connection",
        code: "whatsapp.pairing.failed",
        title: "Pairing failed",
        description: "The gateway could not start a WhatsApp pairing session.",
      });

      return res.status(500).json({
        success: false,
        error: "PAIRING_FAILED",
        message: "Failed to start WhatsApp pairing",
      });
    }
  }),
);

whatsappRouter.post(
  "/rebind",
  requireApiKey,
  createRateLimit({ limit: 5, windowMs: 60_000 }),
  asyncHandler(async (_req, res) => {
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
    } catch {
      void recordActivity({
        level: "error",
        category: "connection",
        code: "whatsapp.rebind.failed",
        title: "Account change failed",
        description: "The gateway could not clear and restart the WhatsApp session.",
      });

      return res.status(500).json({
        success: false,
        error: "REBIND_FAILED",
        message: "Failed to rebind WhatsApp session",
      });
    }
  }),
);
