import { Router } from "express";
import { requireApiKey } from "../middleware/auth.js";
import { getMessageStatus, sendTextMessage } from "../whatsapp.js";

export const messageRouter = Router();

messageRouter.post("/send", requireApiKey, async (req, res) => {
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

    return res.status(202).json({
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

    if (error instanceof Error && error.name === "PHONE_NOT_ON_WHATSAPP") {
      return res.status(404).json({
        success: false,
        error: "PHONE_NOT_ON_WHATSAPP",
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

    if (error instanceof Error && error.name === "MESSAGE_REJECTED") {
      return res.status(502).json({
        success: false,
        error: "MESSAGE_REJECTED",
        message: error.message
      });
    }

    if (error instanceof Error && error.name === "REACHOUT_RESTRICTED") {
      return res.status(429).json({
        success: false,
        error: "REACHOUT_RESTRICTED",
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

messageRouter.get("/:id/status", requireApiKey, (req, res) => {
  const messageId = req.params.id;

  if (typeof messageId !== "string") {
    return res.status(400).json({
      success: false,
      error: "INVALID_MESSAGE_ID",
      message: "Message id is required"
    });
  }

  const result = getMessageStatus(messageId);

  if (!result) {
    return res.status(404).json({
      success: false,
      error: "MESSAGE_STATUS_NOT_FOUND",
      message: "Message status was not found or has expired"
    });
  }

  return res.json({
    success: true,
    ...result
  });
});
