import { type FormEvent, useMemo, useState } from "react";
import { ApiError } from "../../shared/api/client.js";
import type { Notice } from "../../shared/ui/feedback.js";
import type { WhatsAppStatus } from "../whatsapp/api.js";
import { sendMessage } from "./api.js";
import type { LastMessage } from "./types.js";

type UseMessageComposerOptions = {
  isAuthenticated: boolean;
  status: WhatsAppStatus;
  onNotice: (notice: Notice) => void;
  onAfterMutation: () => Promise<void>;
  onAllowRecipient: (phone: string) => Promise<unknown>;
};

export function useMessageComposer({
  isAuthenticated,
  status,
  onNotice,
  onAfterMutation,
  onAllowRecipient,
}: UseMessageComposerOptions) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [recipientApprovalPhone, setRecipientApprovalPhone] = useState<string | null>(null);
  const [recipientRefreshKey, setRecipientRefreshKey] = useState(0);
  const [lastMessage, setLastMessage] = useState<LastMessage | null>(null);
  const [isSending, setIsSending] = useState(false);

  const canSend = useMemo(
    () => isAuthenticated && status === "connected" && Boolean(phone.trim()) && Boolean(message.trim()) && !isSending,
    [isAuthenticated, isSending, message, phone, status],
  );

  const approvalRequired = Boolean(recipientApprovalPhone && recipientApprovalPhone === phone.trim());

  async function sendCurrentMessage(allowFirst = false) {
    const target = phone.trim();
    const text = message.trim();

    if (!target || !text || !isAuthenticated || status !== "connected" || isSending) {
      return;
    }

    setIsSending(true);
    onNotice(null);

    try {
      if (allowFirst) {
        await onAllowRecipient(target);
        setRecipientApprovalPhone(null);
        setRecipientRefreshKey((value) => value + 1);
      }

      const result = await sendMessage(target, text);

      if (result.messageId) {
        setLastMessage({ id: result.messageId, status: result.status });
        onNotice({ type: "success", message: "Message accepted by the gateway. Live status is tracked below." });
      } else {
        onNotice({ type: "success", message: `Message ${result.status}.` });
      }

      setRecipientApprovalPhone(null);
      setMessage("");
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;

      if (apiError?.code === "RECIPIENT_NOT_ALLOWED") {
        setRecipientApprovalPhone(target);
        onNotice({
          type: "error",
          message: "This recipient is not allowed yet. Confirm permission, then use Allow & Send.",
        });
      } else if (apiError?.code === "RECIPIENT_OPTED_OUT") {
        setRecipientApprovalPhone(null);
        onNotice({
          type: "error",
          message: "This recipient has opted out. Re-allow them only after renewed permission.",
        });
      } else {
        setRecipientApprovalPhone(null);
        onNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to send message",
        });
      }
    } finally {
      setIsSending(false);
      await onAfterMutation();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCurrentMessage(false);
  }

  function handlePhoneChange(value: string) {
    setPhone(value);

    if (recipientApprovalPhone && recipientApprovalPhone !== value.trim()) {
      setRecipientApprovalPhone(null);
    }
  }

  function handleRecipientAllowed(allowedPhone: string) {
    if (recipientApprovalPhone === allowedPhone) {
      setRecipientApprovalPhone(null);
    }
  }

  return {
    phone,
    message,
    recipientApprovalPhone,
    recipientRefreshKey,
    lastMessage,
    isSending,
    canSend,
    approvalRequired,
    handlePhoneChange,
    setMessage,
    handleSubmit,
    allowAndSend: () => void sendCurrentMessage(true),
    handleRecipientAllowed,
  };
}
