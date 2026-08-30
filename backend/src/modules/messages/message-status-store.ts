import { getDatabase } from "../../infrastructure/database.js";
import { logger } from "../../infrastructure/logger.js";
import { recordActivity } from "../activity/store.js";
import { enqueueMessageDeliveryWebhook } from "../webhooks/index.js";

export type MessageDeliveryStatus = "pending" | "accepted" | "rejected";

export type StoredMessageStatus = {
  id: string;
  providerMessageId: string | null;
  to: string;
  recipientJid?: string;
  status: MessageDeliveryStatus;
  error?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
};

type MessageStatusRow = {
  id: string;
  provider_message_id: string | null;
  recipient_jid: string | null;
  resolved_jid: string;
  status: MessageDeliveryStatus;
  error_code: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  accepted_at: number | null;
  rejected_at: number | null;
};

const MESSAGE_DIAGNOSTIC_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_MESSAGE_DIAGNOSTICS = 2_000;
const database = getDatabase();

const selectById = database.prepare("SELECT * FROM outbound_messages WHERE id = ?");
const selectByProviderId = database.prepare("SELECT * FROM outbound_messages WHERE provider_message_id = ?");
const insertPending = database.prepare(`
  INSERT OR IGNORE INTO outbound_messages (
    id,
    provider_message_id,
    recipient_jid,
    resolved_jid,
    status,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
`);
const updateTerminal = database.prepare(`
  UPDATE outbound_messages
  SET status = ?,
      error_code = ?,
      error_message = ?,
      updated_at = ?,
      accepted_at = ?,
      rejected_at = ?
  WHERE id = ? AND status = 'pending'
`);
const deleteExpired = database.prepare("DELETE FROM outbound_messages WHERE created_at < ?");
const pruneOverflow = database.prepare(`
  DELETE FROM outbound_messages
  WHERE id IN (
    SELECT id
    FROM outbound_messages
    ORDER BY created_at DESC, id DESC
    LIMIT -1 OFFSET ?
  )
`);

function iso(timestamp: number | null): string | undefined {
  return timestamp == null ? undefined : new Date(timestamp).toISOString();
}

function mapRow(row: MessageStatusRow): StoredMessageStatus {
  return {
    id: row.id,
    providerMessageId: row.provider_message_id,
    to: row.resolved_jid,
    recipientJid: row.recipient_jid ?? undefined,
    status: row.status,
    error: row.error_code ?? undefined,
    message: row.error_message ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    acceptedAt: iso(row.accepted_at),
    rejectedAt: iso(row.rejected_at),
  };
}

function pruneMessageDiagnostics(nowMs: number): void {
  deleteExpired.run(nowMs - MESSAGE_DIAGNOSTIC_RETENTION_MS);
  pruneOverflow.run(MAX_MESSAGE_DIAGNOSTICS);
}

export function rememberPendingMessageStatus(input: {
  id: string;
  providerMessageId: string | null;
  to: string;
  recipientJid?: string;
}): StoredMessageStatus {
  const nowMs = Date.now();
  insertPending.run(input.id, input.providerMessageId, input.recipientJid ?? null, input.to, nowMs, nowMs);
  pruneMessageDiagnostics(nowMs);

  const stored = getMessageStatus(input.id);
  if (!stored) {
    throw new Error("Could not persist outbound message diagnostics");
  }

  void recordActivity({
    level: "info",
    category: "messaging",
    code: "message.queued",
    title: "Message queued",
    description: "An outbound message was submitted to the WhatsApp transport.",
    metadata: {
      messageId: stored.id,
      targetJid: stored.to,
    },
  });

  return stored;
}

export function getMessageStatus(messageId: string): StoredMessageStatus | null {
  const row = selectById.get(messageId) as MessageStatusRow | undefined;
  return row ? mapRow(row) : null;
}

export function getMessageStatusByProviderId(providerMessageId: string): StoredMessageStatus | null {
  const row = selectByProviderId.get(providerMessageId) as MessageStatusRow | undefined;
  return row ? mapRow(row) : null;
}

export function updateMessageStatus(
  messageId: string,
  patch: {
    status: Exclude<MessageDeliveryStatus, "pending">;
    error?: string;
    message?: string;
  },
): StoredMessageStatus | null {
  const nowMs = Date.now();
  const result = updateTerminal.run(
    patch.status,
    patch.error ?? null,
    patch.message ?? null,
    nowMs,
    patch.status === "accepted" ? nowMs : null,
    patch.status === "rejected" ? nowMs : null,
    messageId,
  );

  const current = getMessageStatus(messageId);
  if (!current || Number(result.changes) === 0) {
    return current;
  }

  if (patch.status === "accepted") {
    enqueueMessageDeliveryWebhook({ messageId, status: "accepted" });
    void recordActivity({
      level: "success",
      category: "messaging",
      code: "message.accepted",
      title: "Message accepted by WhatsApp",
      description: "WhatsApp produced a server acknowledgement for the outbound message.",
      metadata: { messageId },
    });
  } else {
    enqueueMessageDeliveryWebhook({
      messageId,
      status: "rejected",
      error: patch.error,
    });
    void recordActivity({
      level: "warning",
      category: "messaging",
      code: "message.rejected",
      title: "Message rejected by WhatsApp",
      description: patch.message ?? "WhatsApp rejected the outbound message.",
      metadata: {
        messageId,
        reason: patch.error,
      },
    });
  }

  return current;
}

export function updateMessageStatusByProviderId(
  providerMessageId: string,
  patch: {
    status: Exclude<MessageDeliveryStatus, "pending">;
    error?: string;
    message?: string;
  },
): StoredMessageStatus | null {
  const current = getMessageStatusByProviderId(providerMessageId);
  if (!current) {
    logger.warn(
      { event: "message.trace_missing", providerMessageId },
      "WhatsApp reported a message update without retained Wago diagnostics",
    );
    return null;
  }

  return updateMessageStatus(current.id, patch);
}

export function resetMessageStatusStoreForTest(): void {
  database.prepare("DELETE FROM outbound_messages").run();
}
