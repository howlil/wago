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
}

export function updateMessageStatus(messageId: string, update: Partial<Omit<StoredMessageStatus, "id" | "to">>): void {
  const existing = messageStatuses.get(messageId);

  if (!existing) {
    return;
  }

  rememberMessageStatus({
    ...existing,
    ...update,
    updatedAt: nowIso(),
  });
}

export function getMessageStatus(messageId: string): StoredMessageStatus | null {
  return messageStatuses.get(messageId) ?? null;
}

export function resetMessageStatusStoreForTest(): void {
  messageStatuses.clear();
}
