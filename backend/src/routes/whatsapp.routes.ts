import { Router } from "express";
import QRCode from "qrcode";
import { requireApiKey } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import { getCurrentQr, getWhatsAppStatus, pairWhatsApp, rebindWhatsApp } from "../whatsapp.js";

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

whatsappRouter.get("/qr/image", requireApiKey, async (_req, res) => {
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
});

whatsappRouter.post("/pair", requireApiKey, createRateLimit({ limit: 5, windowMs: 60_000 }), async (_req, res) => {
  const current = getWhatsAppStatus();

  if (current.binding.state === "bound") {
    return res.status(409).json({
      success: false,
      error: "WHATSAPP_ALREADY_BOUND",
      message: "This gateway is already bound to a WhatsApp account. Use Change account to replace it.",
    });
  }

  try {
    const result = await pairWhatsApp();

    return res.json({
      success: true,
      message: result.status === "qr" ? "WhatsApp QR is ready to scan." : "WhatsApp pairing started.",
      ...result,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "PAIRING_FAILED",
      message: "Failed to start WhatsApp pairing",
    });
  }
});

whatsappRouter.post("/rebind", requireApiKey, createRateLimit({ limit: 5, windowMs: 60_000 }), async (_req, res) => {
  try {
    const result = await rebindWhatsApp();

    return res.json({
      success: true,
      message: "Previous WhatsApp binding was cleared. Scan the new QR to bind another account.",
      ...result,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "REBIND_FAILED",
      message: "Failed to rebind WhatsApp session",
    });
  }
});
