import { WAMessageStatus, type WASocket } from "@whiskeysockets/baileys";
import { logger, maskIdentifier } from "../../infrastructure/logger.js";
import { markRecipientReachoutRestricted, recordOutboundAcknowledged } from "../messages/outbound-policy.js";
import {
  invalidateAccountHealth,
  markReachoutRestricted,
  refreshAccountHealth,
  updateReachoutTimeLock,
} from "./account-health.js";
import { bindWhatsAppAccount, clearWhatsAppBinding } from "./binding-store.js";
import { markConnected, markDisconnected, markQr } from "./connection-state.js";
import { classifyDisconnect } from "./disconnect-classifier.js";
import { mapMessageRejection } from "./message-rejection.js";
import { getMessageStatus, updateMessageStatus } from "./message-status-store.js";
import { auditBaileys, auditDate, createAccountHealthFetcher } from "./observability.js";
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
};

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
}: RegisterSocketEventsOptions): void {
  socket.ev.on("creds.update", () => {
    if (!isCurrentGeneration(generation)) return;
    credentialWriter.enqueue(saveCreds, generation);
  });

  socket.ev.on("messages.update", (updates) => {
    if (!isCurrentGeneration(generation)) return;

    for (const entry of updates) {
      const messageId = entry.key?.id;
      if (!messageId || entry.update.status == null) continue;

      const storedMessage = getMessageStatus(messageId);

      if (entry.update.status === WAMessageStatus.ERROR) {
        const mapped = mapMessageRejection(entry.update.messageStubParameters);
        logger.warn({ event: "wa.message.rejected", messageId, reason: mapped.code });
        auditBaileys({
          level: "warning",
          category: "messaging",
          code: "baileys.message.rejected",
          title: "WhatsApp rejected a message",
          description: "Baileys reported an outbound message rejection.",
          metadata: {
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

        updateMessageStatus(messageId, {
          status: "rejected",
          error: mapped.code,
          message: mapped.message,
        });
        continue;
      }

      if (entry.update.status >= WAMessageStatus.SERVER_ACK) {
        if (storedMessage?.status === "pending") {
          try {
            recordOutboundAcknowledged(storedMessage.recipientJid ?? storedMessage.to, storedMessage.to);
          } catch (error) {
            logger.error(
              {
                event: "outbound.ack_persistence_failed",
                errorName: error instanceof Error ? error.name : "UNKNOWN",
                messageId,
              },
              "WhatsApp acknowledged a message but Wago could not persist recipient success state",
            );
          }
        }

        updateMessageStatus(messageId, { status: "accepted" });
        auditBaileys({
          level: "info",
          category: "messaging",
          code: "baileys.message.ack",
          title: "WhatsApp acknowledged a message",
          description: "Baileys reported a server acknowledgement for an outbound message.",
          metadata: {
            socketGeneration: generation,
            status: entry.update.status,
          },
        });
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
