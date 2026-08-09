import { Router } from "express";
import { requireApiKey } from "../middleware/auth.js";
import { allowRecipient, listRecipients, optOutRecipient } from "../recipient-store.js";

export const recipientRouter = Router();

recipientRouter.get("/", requireApiKey, async (_req, res) => {
  const recipients = await listRecipients();

  return res.json({
    success: true,
    recipients
  });
});

recipientRouter.post("/allow", requireApiKey, async (req, res) => {
  const { phone, label } = req.body as { phone?: unknown; label?: unknown };

  if (typeof phone !== "string" || !phone.trim()) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
      message: "phone is required"
    });
  }

  if (label != null && typeof label !== "string") {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
      message: "label must be a string when provided"
    });
  }

  try {
    const recipient = await allowRecipient(phone, typeof label === "string" ? label : undefined);

    return res.status(201).json({
      success: true,
      recipient
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Phone number")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PHONE",
        message: error.message
      });
    }

    throw error;
  }
});

recipientRouter.post("/:phone/opt-out", requireApiKey, async (req, res) => {
  const phone = req.params.phone;

  if (typeof phone !== "string" || !phone.trim()) {
    return res.status(400).json({
      success: false,
      error: "INVALID_PHONE",
      message: "phone is required"
    });
  }

  try {
    const recipient = await optOutRecipient(phone);

    return res.json({
      success: true,
      recipient
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Phone number")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PHONE",
        message: error.message
      });
    }

    throw error;
  }
});
