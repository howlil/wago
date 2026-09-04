import { WAMessageStatus, type WASocket } from "@whiskeysockets/baileys";
import { logger, maskIdentifier } from "../../infrastructure/logger.js";
import {
  getMessageStatusByProviderId,
  type StoredMessageStatus,
  updateMessageDeliveryEvidenceByProviderId,
  updateMessageStatusByProviderId,
} from "../messages/index.js";
import { markRecipientReachoutRestricted, recordOutboundAcknowledged } from "../messages/outbound-policy.js";
import { rememberRecipientResolution } from "../recipients/store.js";
import {
  enqueueIncomingMediaWebhook,
  enqueueIncomingMessageWebhook,
} from "../webhooks/index.js";
import type {
  IncomingMediaWebhookInput,
  IncomingMessageWebhookInput,
} from "../webhooks/delivery-webhook-core.js";
import {
  invalidateAccountHealth,
  markReachoutRestricted,
  refreshAccountHealth,
  updateNewChatCap,
  updateReachoutTimeLock,
} from "./account-health.js";
import { bindWhatsAppAccount, clearWhatsAppBinding } from "./binding-store.js";
import { markConnected, markDisconnected, markQr } from "./connection-state.js";
import { classifyDisconnect } from "./disconnect-classifier.js";
import {
  type InboundMediaMessage,
  type InboundTextMessage,
  normalizeInboundMediaMessage,
  normalizeInboundTextMessage,
} from "./inbound-message.js";
import { mapMessageRejection } from "./message-rejection.js";
import { auditBaileys, auditDate, createAccountHealthFetcher } from "./observability.js";
import { rememberRecentInboundMessage } from "./recent-inbound-store.js";
import { invalidateRecipientLookupCache } from "./recipient-cache.js";
import { rememberRecipientIdentity } from "./recipient-identity-store.js";
import {
  getActiveSocket,
  invalidateSocketGeneration,
  isRebindInProgress,
  isShuttingDown,
  setActiveSocket,
} from "./runtime.js";

type CredentialWriter = {
  enqueue: (saveCreds: () => Promise<void>, generation: number) => void;
};

type RegisterSocketEventsOptions = {
  socket: WASocket;
  generation: number;
  saveCreds: () => Promise<void>;
  credentialWriter: CredentialWriter;
  isCurrentGeneration: (generation: number) => boolean;
  getReconnectAttempt: () => number;
  resetReconnectAttempt: () => void;
  scheduleReconnect: (generation: number) => void;
  clearReconnectTimer?: () => void;
  onIncomingMessage?: (message: IncomingMessageWebhookInput) => void;
  onIncomingMediaMessage?: (message: IncomingMediaWebhookInput) => void;
};

function receiptTimestamp(value: unknown): Date {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

function acceptPendingOutbound(providerMessageId: string, storedMessage: StoredMessageStatus | null): void {
  if (storedMessage?.status !== "pending") return;

  try {
    recordOutboundAcknowledged(storedMessage.recipientJid ?? storedMessage.to, storedMessage.to);
  } catch (error) {
    logger.error(
      {
        event: "outbound.ack_persistence_failed",
        errorName: error instanceof Error ? error.name : "UNKNOWN",
        messageId: storedMessage.id,
      },
      "WhatsApp acknowledged a message but Wago could not persist recipient success state",
    );
  }

  updateMessageStatusByProviderId(providerMessageId, { status: "accepted" });
}

function canonicalQuotedMessageId(providerMessageId?: string): string | undefined {
  if (!providerMessageId) return undefined;
  return getMessageStatusByProviderId(providerMessageId)?.id ?? undefined;
}

function incomingTextWebhookInput(message: InboundTextMessage): IncomingMessageWebhookInput {
  const replyToMessageId = canonicalQuotedMessageId(message.quotedProviderMessageId);
  return {
    messageId: message.messageId,
    from: message.from,
    text: message.text,
    receivedAt: message.receivedAt,
    ...(replyToMessageId ? { replyToMessageId } : {}),
  };
}

function incomingMediaWebhookInput(message: InboundMediaMessage): IncomingMediaWebhookInput {
  const replyToMessageId = canonicalQuotedMessageId(message.quotedProviderMessageId);
  return {
    messageId: message.messageId,
    from: message.from,
    receivedAt: message.receivedAt,
    media: message.media,
    ...(replyToMessageId ? { replyToMessageId } : {}),
  };
}

export function registerSocketEvents({
  socket,
  generation,
  saveCreds,
  credentialWriter,
  isCurrentGeneration,
  getReconnectAttempt,
  resetReconnectAttempt,
  scheduleReconnect,
  clearReconnectTimer,
  onIncomingMessage = enqueueIncomingMessageWebhook,
  onIncomingMediaMessage = enqueueIncomingMediaWebhook,
}: RegisterSocketEventsOptions): void {
  socket.ev.on("creds.update", () => {
    if (!isCurrentGeneration(generation)) return;
    credentialWriter.enqueue(saveCreds, generation);
  });

  socket.ev.on("lid-mapping.update", (mapping) => {
    if (!isCurrentGeneration(generation)) return;
    rememberRecipientIdentity(mapping.pn, mapping.lid);
    invalidateRecipientLookupCache(mapping.pn);
    void rememberRecipientResolution(mapping.pn, mapping.lid);
    auditBaileys({
      level: "info",
      category: "connection",
      code: "baileys.recipient.lid_mapping_updated",
      title: "Recipient addressing refreshed",
      description: "WhatsApp supplied a newer phone-to-LID mapping for recipient addressing.",
      metadata: { socketGeneration: generation },
    });
  });

  socket.ev.on("message-capping.update", (cap) => {
    if (!isCurrentGeneration(generation)) return;
    updateNewChatCap(cap);
    auditBaileys({
      level: cap.capping_status === "CAPPED" ? "warning" : "info",
      category: "connection",
      code: "baileys.health.new_chat_cap_changed",
      title: "New-chat capacity changed",
      description: "WhatsApp pushed an updated new-chat capacity state.",
      metadata: {
        socketGeneration: generation,
        cappingStatus: cap.capping_status ?? null,
        usedQuota: cap.used_quota ?? null,
        totalQuota: cap.total_quota ?? null,
        cycleEndAt: cap.cycle_end_timestamp ?? null,
      },
    });
  });

  socket.ev.on("messages.upsert", (event) => {
    if (!isCurrentGeneration(generation) || event.type !== "notify") return;

    for (const message of event.messages) {
      const incomingText = normalizeInboundTextMessage(message);
      if (incomingText) {
        rememberRecentInboundMessage(incomingText.messageId, incomingText.from, message);
        auditBaileys({
          level: "info",
          category: "messaging",
          code: "baileys.message.received",
          title: "Incoming WhatsApp message received",
          description: "A direct incoming text message was accepted for Wago webhook processing.",
          metadata: {
            messageId: incomingText.messageId,
            socketGeneration: generation,
          },
        });
        onIncomingMessage(incomingTextWebhookInput(incomingText));
        continue;
      }

      const incomingMedia = normalizeInboundMediaMessage(message);
      if (!incomingMedia) continue;

      rememberRecentInboundMessage(incomingMedia.messageId, incomingMedia.from, message);
      auditBaileys({
        level: "info",
        category: "messaging",
        code: "baileys.message.media_received",
        title: "Incoming WhatsApp media received",
        description: "Direct incoming media metadata was accepted; media bytes remain ephemeral.",
        metadata: {
          messageId: incomingMedia.messageId,
          mediaKind: incomingMedia.media.kind,
          socketGeneration: generation,
        },
      });
      onIncomingMediaMessage(incomingMediaWebhookInput(incomingMedia));
    }
  });

  socket.ev.on("messages.update", (updates) => {
    if (!isCurrentGeneration(generation)) return;

    for (const entry of updates) {
      const providerMessageId = entry.key?.id;
      if (!providerMessageId || entry.update.status == null) continue;

      const storedMessage = getMessageStatusByProviderId(providerMessageId);
      const messageId = storedMessage?.id ?? null;

      if (entry.update.status === WAMessageStatus.ERROR) {
        const mapped = mapMessageRejection(entry.update.messageStubParameters);
        logger.warn({ event: "wa.message.rejected", messageId, providerMessageId, reason: mapped.code });
        auditBaileys({
          level: "warning",
          category: "messaging",
          code: "baileys.message.rejected",
          title: "WhatsApp rejected a message",
          description: "Baileys reported an outbound message rejection.",
          metadata: {
            messageId,
            socketGeneration: generation,
            status: entry.update.status,
            reason: mapped.code,
          },
        });

        if (mapped.code === "REACHOUT_RESTRICTED") {
          markReachoutRestricted();
          void refreshAccountHealth(createAccountHealthFetcher(socket, generation), { force: true });
          if (storedMessage?.status === "pending") {
            void markRecipientReachoutRestricted(storedMessage.recipientJid ?? storedMessage.to);
          }
        }

        updateMessageStatusByProviderId(providerMessageId, {
          status: "rejected",
          error: mapped.code,
          message: mapped.message,
        });
        continue;
      }

      if (entry.update.status >= WAMessageStatus.SERVER_ACK) {
        acceptPendingOutbound(providerMessageId, storedMessage);
        updateMessageDeliveryEvidenceByProviderId(providerMessageId, "server_accepted");
        auditBaileys({
          level: "info",
          category: "messaging",
          code: "baileys.message.ack",
          title: "WhatsApp acknowledged a message",
          description: "Baileys reported a server acknowledgement for an outbound message.",
          metadata: {
            messageId,
            socketGeneration: generation,
            status: entry.update.status,
          },
        });
      }
    }
  });

  socket.ev.on("message-receipt.update", (updates) => {
    if (!isCurrentGeneration(generation)) return;

    for (const entry of updates) {
      const providerMessageId = entry.key?.id;
      if (!providerMessageId) continue;

      const storedMessage = getMessageStatusByProviderId(providerMessageId);
      if (!storedMessage || storedMessage.status === "rejected") continue;
      acceptPendingOutbound(providerMessageId, storedMessage);

      if (entry.receipt.playedTimestamp != null) {
        updateMessageDeliveryEvidenceByProviderId(
          providerMessageId,
          "played",
          receiptTimestamp(entry.receipt.playedTimestamp),
        );
      } else if (entry.receipt.readTimestamp != null) {
        updateMessageDeliveryEvidenceByProviderId(
          providerMessageId,
          "read",
          receiptTimestamp(entry.receipt.readTimestamp),
        );
      } else if (entry.receipt.receiptTimestamp != null) {
        updateMessageDeliveryEvidenceByProviderId(
          providerMessageId,
          "delivered",
          receiptTimestamp(entry.receipt.receiptTimestamp),
        );
      }
    }
  });

  socket.ev.on("connection.update", (update) => {
    if (!isCurrentGeneration(generation)) return;

    if (update.qr) {
      markQr(update.qr);
      logger.info({ event: "wa.connection", state: "qr" });
      auditBaileys({
        level: "info",
        category: "connection",
        code: "baileys.connection.qr_ready",
        title: "WhatsApp pairing QR is ready",
        description: "A pairing QR became available. The QR value is intentionally not persisted.",
        metadata: { socketGeneration: generation },
      });
    }

    if (update.connection === "open") {
      const accountJid = socket.user?.id;
      if (accountJid) {
        const binding = bindWhatsAppAccount(accountJid);
        logger.info({ event: "wa.binding", state: "bound", account: maskIdentifier(binding.jid) });
      }

      markConnected();
      resetReconnectAttempt();
      logger.info({ event: "wa.connection", state: "connected" });
      auditBaileys({
        level: "success",
        category: "connection",
        code: "baileys.connection.open",
        title: "WhatsApp connection opened",
        description: "The Baileys socket is connected to WhatsApp.",
        metadata: {
          socketGeneration: generation,
          bound: Boolean(accountJid),
        },
      });
      void refreshAccountHealth(createAccountHealthFetcher(socket, generation), { force: true });
    }

    if (update.reachoutTimeLock) {
      updateReachoutTimeLock(update.reachoutTimeLock);
      logger.warn({
        event: "wa.reachout_timelock",
        active: update.reachoutTimeLock.isActive,
        retryAt: update.reachoutTimeLock.timeEnforcementEnds,
      });
      auditBaileys({
        level: update.reachoutTimeLock.isActive ? "warning" : "info",
        category: "connection",
        code: "baileys.health.reachout_timelock_changed",
        title: "Reach-out restriction changed",
        description: "WhatsApp pushed a reach-out restriction state update.",
        metadata: {
          socketGeneration: generation,
          active: Boolean(update.reachoutTimeLock.isActive),
          retryAt: auditDate(update.reachoutTimeLock.timeEnforcementEnds),
          enforcementType: update.reachoutTimeLock.enforcementType ?? null,
        },
      });
    }

    if (update.connection === "close") {
      const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
        ?.statusCode;
      const classification = classifyDisconnect({
        statusCode,
        rebindInProgress: isRebindInProgress(),
        shuttingDown: isShuttingDown(),
      });

      auditBaileys({
        level: classification.terminal ? "error" : "warning",
        category: "connection",
        code: "baileys.connection.close",
        title: "WhatsApp connection closed",
        description: classification.terminal
          ? "The WhatsApp session closed and requires a new pairing."
          : "The WhatsApp connection closed and may be retried.",
        metadata: {
          socketGeneration: generation,
          statusCode: classification.statusCode ?? null,
          reason: classification.reason,
          terminal: classification.terminal,
          reconnect: classification.shouldReconnect,
          reconnectAttempt: getReconnectAttempt(),
        },
      });

      markDisconnected();
      invalidateAccountHealth(classification.terminal ? "session_invalid" : "not_connected");
      if (getActiveSocket() === socket) setActiveSocket(undefined);
      invalidateSocketGeneration();

      if (classification.terminal && !isRebindInProgress()) {
        clearWhatsAppBinding();
        clearReconnectTimer?.();
        auditBaileys({
          level: "error",
          category: "connection",
          code: "baileys.session.invalidated",
          title: "WhatsApp session invalidated",
          description: "The linked WhatsApp session is no longer valid and must be paired again.",
          metadata: {
            socketGeneration: generation,
            statusCode: classification.statusCode ?? null,
            reason: classification.reason,
          },
        });
      }

      logger.warn({
        event: "wa.connection",
        state: "disconnected",
        statusCode: classification.statusCode,
        reason: classification.reason,
        terminal: classification.terminal,
        reconnect: classification.shouldReconnect,
      });

      if (classification.shouldReconnect) scheduleReconnect(generation);
    }
  });
}
