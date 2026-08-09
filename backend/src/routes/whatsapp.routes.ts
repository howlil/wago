import { Router } from "express";
import QRCode from "qrcode";
import { getCurrentQr, getWhatsAppStatus } from "../whatsapp.js";

export const whatsappRouter = Router();

whatsappRouter.get("/status", (_req, res) => {
  res.json({
    success: true,
    ...getWhatsAppStatus()
  });
});

whatsappRouter.get("/qr", (_req, res) => {
  res.json({
    success: true,
    ...getCurrentQr()
  });
});

whatsappRouter.get("/qr/image", async (_req, res) => {
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
