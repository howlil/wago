import { Router } from "express";
import { asyncHandler } from "../../http/middleware/async-handler.js";
import { requireAuthenticatedRequest } from "../../http/middleware/auth.js";
import { recordActivity } from "../activity/store.js";
import { allowRecipient, listRecipients, optOutRecipient } from "./store.js";

export const recipientRouter = Router();

recipientRouter.get(
  "/",
  requireAuthenticatedRequest,
  asyncHandler(async (_req, res) => {
    const recipients = await listRecipients();

    return res.json({
      success: true,
      recipients,
    });
  }),
);

recipientRouter.post(
  "/allow",
  requireAuthenticatedRequest,
  asyncHandler(async (req, res) => {
    const { phone, label } = req.body as { phone?: unknown; label?: unknown };

    if (typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "phone is required",
      });
    }

    if (label != null && typeof label !== "string") {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "label must be a string when provided",
      });
    }

    const recipient = await allowRecipient(phone, typeof label === "string" ? label : undefined);

    void recordActivity({
      level: "success",
      category: "recipient",
      code: "recipient.allowed",
      title: "Recipient allowed",
      description: "This recipient can now receive outbound messages from the gateway.",
      metadata: {
        recipientJid: recipient.jid,
        label: recipient.label ?? null,
      },
    });

    return res.status(201).json({
      success: true,
      recipient,
    });
  }),
);

recipientRouter.post(
  "/:phone/opt-out",
  requireAuthenticatedRequest,
  asyncHandler(async (req, res) => {
    const phone = req.params.phone;

    if (typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PHONE",
        message: "phone is required",
      });
    }

    const recipient = await optOutRecipient(phone);

    void recordActivity({
      level: "warning",
      category: "recipient",
      code: "recipient.opted_out",
      title: "Recipient opted out",
      description: "Outbound messages to this recipient are blocked until permission is explicitly restored.",
      metadata: {
        recipientJid: recipient.jid,
        label: recipient.label ?? null,
      },
    });

    return res.json({
      success: true,
      recipient,
    });
  }),
);
