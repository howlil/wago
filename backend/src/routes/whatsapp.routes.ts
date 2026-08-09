import { Router } from "express";
import QRCode from "qrcode";
import { requireApiKey } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import { getCurrentQr, getWhatsAppStatus, rebindWhatsApp } from "../whatsapp.js";

export const whatsappRouter = Router();

whatsappRouter.get("/status", requireApiKey, (_req, res) => {
  res.json({
    success: true,
    ...getWhatsAppStatus()
  });
});

whatsappRouter.get("/qr", requireApiKey, (_req, res) => {
  res.json({
    success: true,
    ...getCurrentQr()
  });
});

whatsappRouter.get("/qr/image", requireApiKey, async (_req, res) => {
  const { qr, status } = getCurrentQr();

  if (!qr) {
    return res.status(status === "connected" ? 200 : 404).json({
      success: status === "connected",
      qr: null,
      status,
      message: status === "connected" ? "WhatsApp is already connected" : "QR is not available"
    });
  }

  const svg = await QRCode.toString(qr, {
    type: "svg",
    margin: 2,
    width: 320
  });

  return res.type("image/svg+xml").send(svg);
});

whatsappRouter.post("/rebind", requireApiKey, createRateLimit({ limit: 5, windowMs: 60_000 }), async (_req, res) => {
  try {
    const result = await rebindWhatsApp();

    return res.json({
      success: true,
      message: "WhatsApp session was cleared. Scan the new QR to bind another account.",
      ...result
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "REBIND_FAILED",
      message: "Failed to rebind WhatsApp session"
    });
  }
});
