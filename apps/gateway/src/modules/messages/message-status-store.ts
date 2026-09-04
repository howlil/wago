import { getDatabase } from "../../infrastructure/database.js";
import { logger } from "../../infrastructure/logger.js";
import { recordActivity } from "../activity/store.js";
import { enqueueMessageDeliveryWebhook } from "../webhooks/index.js";

export type MessageDeliveryStatus = "pending" | "accepted" | "rejected";
export type MessageDispatchState = "prepared" | "submitting" | "submitted" | "indeterminate";
export type MessageDeliveryEvidence = "submitted" | "server_accepted" | "delivered" | "read" | "played";

export type StoredMessageStatus = {
  id: string;
  providerMessageId: string | null;
  to: string;
  recipientJid?: string;
  status: MessageDeliveryStatus;
  dispatchState: MessageDispatchState;
  deliveryEvidence?: MessageDeliveryEvidence;
  error?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  serverAcceptedAt?: string;
  deliveredAt?: string;
  readAt?: string;
  playedAt?: string;
};

type MessageStatusRow = {
  id: string;
  provider_message_id: string | null;
  recipient_jid: string | null;
  resolved_jid: string;
  status: MessageDeliveryStatus;
  dispatch_state: MessageDispatchState;
  delivery_evidence: MessageDeliveryEvidence | null;
  error_code: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  accepted_at: number | null;
  rejected_at: number | null;
  server_accepted_at: number | null;
  delivered_at: number | null;
  read_at: number | null;
  played_at: number | null;
};

const MESSAGE_DIAGNOSTIC_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_MESSAGE_DIAGNOSTICS = 2_000;
const database = getDatabase();

const evidenceRank: Record<MessageDeliveryEvidence, number> = {
  submitted: 0,
  server_accepted: 1,
  delivered: 2,
  read: 3,
  played: 4,
};

const selectById = database.prepare("SELECT * FROM outbound_messages WHERE id = ?");
const selectByProviderId = database.prepare("SELECT * FROM outbound_messages WHERE provider_message_id = ?");
const selectByDispatchState = database.prepare(
  "SELECT * FROM outbound_messages WHERE status = 'pending' AND dispatch_state = ? ORDER BY created_at ASC",
);
const insertPending = database.prepare(`
  INSERT OR IGNORE INTO outbound_messages (
    id,
    provider_message_id,
    recipient_jid,
    resolved_jid,
    status,
    delivery_evidence,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, 'pending', 'submitted', ?, ?)
`);
const insertPrepared = database.prepare(`
  INSERT INTO outbound_messages (
    id,
    provider_message_id,
    recipient_jid,
    resolved_jid,
    status,
    dispatch_state,
    created_at,
    updated_at
  ) VALUES (?, NULL, ?, ?, 'pending', 'prepared', ?, ?)
`);
const transitionDispatchState = database.prepare(`
  UPDATE outbound_messages
  SET dispatch_state = ?, updated_at = ?
  WHERE id = ? AND status = 'pending' AND dispatch_state = ?
`);
const markSubmitted = database.prepare(`
  UPDATE outbound_messages
  SET provider_message_id = ?, dispatch_state = 'submitted', delivery_evidence = 'submitted', updated_at = ?
  WHERE id = ? AND status = 'pending' AND dispatch_state = 'submitting'
`);
const updateEvidence = database.prepare(`
  UPDATE outbound_messages
  SET delivery_evidence = ?,
      updated_at = ?,
      server_accepted_at = ?,
      delivered_at = ?,
      read_at = ?,
      played_at = ?
  WHERE id = ?
`);
const deletePending = database.prepare("DELETE FROM outbound_messages WHERE id = ? AND status = 'pending'");
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
    dispatchState: row.dispatch_state,
    deliveryEvidence: row.delivery_evidence ?? undefined,
    error: row.error_code ?? undefined,
    message: row.error_message ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    acceptedAt: iso(row.accepted_at),
    rejectedAt: iso(row.rejected_at),
    serverAcceptedAt: iso(row.server_accepted_at),
    deliveredAt: iso(row.delivered_at),
    readAt: iso(row.read_at),
    playedAt: iso(row.played_at),
  };
}

function pruneMessageDiagnostics(nowMs: number): void {
  deleteExpired.run(nowMs - MESSAGE_DIAGNOSTIC_RETENTION_MS);
  pruneOverflow.run(MAX_MESSAGE_DIAGNOSTICS);
}

function recordEvidenceActivity(messageId: string, evidence: MessageDeliveryEvidence): void {
  if (evidence === "submitted" || evidence === "server_accepted") return;
  const title =
    evidence === "delivered"
      ? "Message delivered"
      : evidence === "read"
        ? "Message read"
        : "Message played";
  void recordActivity({
    level: "info",
    category: "messaging",
    code: `message.${evidence}`,
    title,
    description: `WhatsApp reported ${evidence.replace("_", " ")} evidence for the outbound message.`,
    metadata: { messageId },
  });
  enqueueMessageDeliveryWebhook({ messageId, status: evidence });
}

export function prepareMessageStatus(input: { id: string; to: string; recipientJid?: string }): StoredMessageStatus {
  const nowMs = Date.now();
  insertPrepared.run(input.id, input.recipientJid ?? null, input.to, nowMs, nowMs);
  pruneMessageDiagnostics(nowMs);

  const stored = getMessageStatus(input.id);
  if (!stored) {
    throw new Error("Could not persist prepared outbound message diagnostics");
  }
  return stored;
}

export function markMessageSubmitting(messageId: string): StoredMessageStatus | null {
  const nowMs = Date.now();
  const result = transitionDispatchState.run("submitting", nowMs, messageId, "prepared");
  if (Number(result.changes) === 0) {
    return getMessageStatus(messageId);
  }
  return getMessageStatus(messageId);
}

export function markMessageSubmitted(messageId: string, providerMessageId: string | null): StoredMessageStatus | null {
  const nowMs = Date.now();
  const result = markSubmitted.run(providerMessageId, nowMs, messageId);
  const current = getMessageStatus(messageId);
  if (!current || Number(result.changes) === 0) {
    return current;
  }

  void recordActivity({
    level: "info",
    category: "messaging",
    code: "message.queued",
    title: "Message queued",
    description: "An outbound message was submitted to the WhatsApp transport.",
    metadata: {
      messageId: current.id,
      targetJid: current.to,
    },
  });

  return current;
}

export function markMessageIndeterminate(messageId: string): StoredMessageStatus | null {
  const nowMs = Date.now();
  transitionDispatchState.run("indeterminate", nowMs, messageId, "submitting");
  return getMessageStatus(messageId);
}

export function deletePendingMessageStatus(messageId: string): boolean {
  return Number(deletePending.run(messageId).changes) > 0;
}

export function listPendingMessagesByDispatchState(dispatchState: MessageDispatchState): StoredMessageStatus[] {
  return (selectByDispatchState.all(dispatchState) as MessageStatusRow[]).map(mapRow);
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

export function updateMessageDeliveryEvidence(
  messageId: string,
  evidence: MessageDeliveryEvidence,
  observedAt = new Date(),
): StoredMessageStatus | null {
  const current = getMessageStatus(messageId);
  if (!current) return null;
  if (current.deliveryEvidence && evidenceRank[evidence] <= evidenceRank[current.deliveryEvidence]) {
    return current;
  }

  const observedAtMs = observedAt.getTime();
  const serverAcceptedAt = current.serverAcceptedAt
    ? new Date(current.serverAcceptedAt).getTime()
    : evidenceRank[evidence] >= evidenceRank.server_accepted
      ? observedAtMs
      : null;
  const deliveredAt = current.deliveredAt
    ? new Date(current.deliveredAt).getTime()
    : evidenceRank[evidence] >= evidenceRank.delivered
      ? observedAtMs
      : null;
  const readAt = current.readAt
    ? new Date(current.readAt).getTime()
    : evidenceRank[evidence] >= evidenceRank.read
      ? observedAtMs
      : null;
  const playedAt = current.playedAt
    ? new Date(current.playedAt).getTime()
    : evidenceRank[evidence] >= evidenceRank.played
      ? observedAtMs
      : null;

  updateEvidence.run(evidence, observedAtMs, serverAcceptedAt, deliveredAt, readAt, playedAt, messageId);
  recordEvidenceActivity(messageId, evidence);
  return getMessageStatus(messageId);
}

export function updateMessageDeliveryEvidenceByProviderId(
  providerMessageId: string,
  evidence: MessageDeliveryEvidence,
  observedAt = new Date(),
): StoredMessageStatus | null {
  const current = getMessageStatusByProviderId(providerMessageId);
  if (!current) {
    logger.warn(
      { event: "message.trace_missing", providerMessageId, evidence },
      "WhatsApp reported delivery evidence without retained Wago diagnostics",
    );
    return null;
  }
  return updateMessageDeliveryEvidence(current.id, evidence, observedAt);
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
