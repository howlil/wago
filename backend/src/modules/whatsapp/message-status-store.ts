import { recordActivity } from "../../activity/store.js";
import { enqueueMessageDeliveryWebhook } from "../../webhooks/delivery-webhook.js";

export type MessageDeliveryStatus = "pending" | "accepted" | "rejected";

export type StoredMessageStatus = {
  id: string;
  to: string;
  status: MessageDeliveryStatus;
  error?: string;
  message?: string;
  updatedAt: string;
};

const MESSAGE_STATUS_TTL_MS = 1000 * 60 * 60;
const messageStatuses = new Map<string, StoredMessageStatus>();

function nowIso(): string {
  return new Date().toISOString();
}

export function rememberMessageStatus(statusEntry: StoredMessageStatus): void {
  messageStatuses.set(statusEntry.id, statusEntry);

  const expiresAt = Date.now() + MESSAGE_STATUS_TTL_MS;
  setTimeout(() => {
    const current = messageStatuses.get(statusEntry.id);

    if (current?.updatedAt === statusEntry.updatedAt && Date.now() >= expiresAt) {
      messageStatuses.delete(statusEntry.id);
    }
  }, MESSAGE_STATUS_TTL_MS).unref();
}

export function rememberPendingMessageStatus(input: { id: string; to: string }): void {
  rememberMessageStatus({
    id: input.id,
    to: input.to,
    status: "pending",
    updatedAt: nowIso(),
  });

  void recordActivity({
    level: "info",
    category: "messaging",
    code: "message.queued",
    title: "Message queued",
    description: "The gateway accepted an outbound message and is waiting for WhatsApp acknowledgement.",
    metadata: {
      messageId: input.id,
      targetJid: input.to,
    },
  });
}

export function updateMessageStatus(messageId: string, update: Partial<Omit<StoredMessageStatus, "id" | "to">>): void {
  const existing = messageStatuses.get(messageId);

  if (!existing) {
    return;
  }

  const next = {
    ...existing,
    ...update,
    updatedAt: nowIso(),
  };
  rememberMessageStatus(next);

  if (next.status === existing.status) {
    return;
  }

  if (next.status === "accepted") {
    enqueueMessageDeliveryWebhook({
      messageId,
      status: "accepted",
    });

    void recordActivity({
      level: "success",
      category: "messaging",
      code: "message.accepted",
      title: "Message accepted by WhatsApp",
      description: "WhatsApp acknowledged the outbound message.",
      metadata: {
        messageId,
        targetJid: existing.to,
      },
    });
    return;
  }

  if (next.status === "rejected") {
    enqueueMessageDeliveryWebhook({
      messageId,
      status: "rejected",
      ...(next.error ? { error: next.error } : {}),
    });

    void recordActivity({
      level: "warning",
      category: "messaging",
      code: "message.rejected",
      title: "Message rejected by WhatsApp",
      description: "WhatsApp reported that the outbound message could not be accepted.",
      metadata: {
        messageId,
        targetJid: existing.to,
        reason: next.error ?? null,
      },
    });
  }
}

export function getMessageStatus(messageId: string): StoredMessageStatus | null {
  return messageStatuses.get(messageId) ?? null;
}

export function resetMessageStatusStoreForTest(): void {
  messageStatuses.clear();
}
