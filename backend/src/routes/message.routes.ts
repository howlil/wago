import { Router } from "express";
import { sendTextMessage } from "../whatsapp.js";

export const messageRouter = Router();

messageRouter.post("/send", async (req, res) => {
  const { to, text } = req.body as { to?: unknown; text?: unknown };

  if (typeof to !== "string" || typeof text !== "string" || !to.trim() || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
      message: "to and text are required"
    });
  }

  try {
    const result = await sendTextMessage(to, text);

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error instanceof Error && error.name === "WHATSAPP_NOT_CONNECTED") {
      return res.status(503).json({
        success: false,
        error: "WHATSAPP_NOT_CONNECTED",
        message: error.message
      });
    }

    if (error instanceof Error && error.message.includes("Phone number")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PHONE",
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: "SEND_MESSAGE_FAILED",
      message: "Failed to send WhatsApp message"
    });
  }
});
