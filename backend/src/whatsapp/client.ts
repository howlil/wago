import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import makeWASocket, { useMultiFileAuthState, WAMessageStatus, type WASocket } from "@whiskeysockets/baileys";
import { type BaileysAuditInput, recordBaileysAudit } from "../activity/baileys-audit.js";
import { config } from "../config/index.js";
import { baileysLogger, logger, maskIdentifier } from "../infrastructure/logger.js";
import {
  checkOutboundPolicy,
  createOutboundPolicyError,
  markRecipientReachoutRestricted,
  recordOutboundAccepted,
  recordOutboundRejected,
} from "../policy/outbound-policy.js";
import { toWhatsAppJid } from "../utils/phone.js";
import {
  type AccountHealthFetcher,
  invalidateAccountHealth,
  markReachoutRestricted,
  refreshAccountHealth,
  updateReachoutTimeLock,
} from "./account-health.js";
import { bindWhatsAppAccount, clearWhatsAppBinding, getWhatsAppBinding } from "./binding-store.js";
import {
  getConnectionStatus,
  getCurrentQrState,
  getWhatsAppStatusSnapshot,
  markConnected,
  markConnecting,
  markDisconnected,
  markQr,
  type WhatsAppStatus,
  type WhatsAppStatusSnapshot,
} from "./connection-state.js";
import { classifyDisconnect } from "./disconnect-classifier.js";
import { mapMessageRejection } from "./message-rejection.js";
import { getMessageStatus, rememberPendingMessageStatus, updateMessageStatus } from "./message-status-store.js";
import { getRecentMessage, rememberRecentTextMessage } from "./recent-message-store.js";
import { resolveRecipientJid } from "./recipient-cache.js";
import { getReconnectDelayMs, nextReconnectAttempt, resetReconnectAttempts } from "./reconnect-state.js";

export type { WhatsAppStatus, WhatsAppStatusSnapshot };
export { getMessageStatus };

export type SendTextMessageOptions = {
  idempotencyKey?: string;
};

export type SendTextMessageResult = {
  messageId: string | null;
  status: "pending";
};

const REACHOUT_RESTRICTION_COOLDOWN_MS = 1000 * 60 * 30;
const CREDENTIAL_AUDIT_INTERVAL_MS = 1000 * 60;
const authDirectory = config.authDirectory;
const credentialsFile = resolve(authDirectory, "creds.json");

let socket: WASocket | undefined;
let reconnecting = false;
let rebindInProgress = false;
let shuttingDown = false;
let socketGeneration = 0;
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | undefined;
let credentialWriteQueue: Promise<void> = Promise.resolve();
let lastCredentialAuditGeneration = 0;
let lastCredentialAuditAt = 0;

function createNamedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function auditBaileys(input: BaileysAuditInput): void {
  void recordBaileysAudit(input).catch((error) => {
    logger.warn({ event: "wa.audit.persist_failed", error }, "Failed to persist Baileys audit event");
  });
}

function auditDate(value: Date | string | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function makeAccountHealthFetcher(activeSocket: WASocket, generation = socketGeneration): AccountHealthFetcher {
  return {
    fetchAccountReachoutTimelock: async () => {
      try {
        const state = await activeSocket.fetchAccountReachoutTimelock();
        auditBaileys({
          level: state?.isActive ? "warning" : "info",
          category: "connection",
          code: "baileys.health.reachout_timelock",
          title: "Reach-out health checked",
          description: "WhatsApp reach-out restriction state was refreshed.",
          metadata: {
            socketGeneration: generation,
            active: Boolean(state?.isActive),
            retryAt: auditDate(state?.timeEnforcementEnds),
            enforcementType: state?.enforcementType ?? null,
          },
        });
        return state;
      } catch (error) {
        auditBaileys({
          level: "warning",
          category: "connection",
          code: "baileys.health.fetch_failed",
          title: "Account health check failed",
          description: "WhatsApp reach-out health could not be refreshed.",
          metadata: {
            socketGeneration: generation,
            operation: "reachout_timelock",
            errorName: error instanceof Error ? error.name : "UNKNOWN",
          },
        });
        throw error;
      }
    },
    fetchNewChatMessageCap: async () => {
      try {
        const cap = await activeSocket.fetchNewChatMessageCap();
        auditBaileys({
          level: cap?.capping_status === "CAPPED" ? "warning" : "info",
          category: "connection",
          code: "baileys.health.new_chat_cap",
          title: "New-chat cap checked",
          description: "WhatsApp new-chat capacity state was refreshed.",
          metadata: {
            socketGeneration: generation,
            cappingStatus: cap?.capping_status ?? null,
            totalQuota: cap?.total_quota ?? null,
            usedQuota: cap?.used_quota ?? null,
          },
        });
        return cap;
      } catch (error) {
        auditBaileys({
          level: "warning",
          category: "connection",
          code: "baileys.health.fetch_failed",
          title: "Account health check failed",
          description: "WhatsApp new-chat capacity could not be refreshed.",
          metadata: {
            socketGeneration: generation,
            operation: "new_chat_cap",
            errorName: error instanceof Error ? error.name : "UNKNOWN",
          },
        });
        throw error;
      }
    },
  };
}

function shouldAuditCredentialSuccess(generation: number, now: number): boolean {
  if (generation !== lastCredentialAuditGeneration || now - lastCredentialAuditAt >= CREDENTIAL_AUDIT_INTERVAL_MS) {
    lastCredentialAuditGeneration = generation;
    lastCredentialAuditAt = now;
    return true;
  }

  return false;
}

function enqueueCredentialWrite(saveCreds: () => Promise<void>, generation: number): void {
  credentialWriteQueue = credentialWriteQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await saveCreds();
        const now = Date.now();
        if (shouldAuditCredentialSuccess(generation, now)) {
          auditBaileys({
            level: "info",
            category: "security",
            code: "baileys.credentials.persisted",
            title: "WhatsApp credentials persisted",
            description: "Updated Baileys credentials were persisted successfully.",
            metadata: {
              socketGeneration: generation,
            },
          });
        }
      } catch (error) {
        logger.error({ event: "wa.credentials.persist_failed", error }, "Failed to persist WhatsApp credentials");
        auditBaileys({
          level: "error",
          category: "security",
          code: "baileys.credentials.persist_failed",
          title: "WhatsApp credential persistence failed",
          description: "Baileys credential state could not be persisted.",
          metadata: {
            socketGeneration: generation,
            errorName: error instanceof Error ? error.name : "UNKNOWN",
          },
        });
      }
    });
}

async function flushCredentialWrites(): Promise<void> {
  await credentialWriteQueue.catch(() => undefined);
}

function clearReconnectTimer(): void {
  if (!reconnectTimer) {
    return;
  }

  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
}

function scheduleReconnect(closedGeneration: number): void {
  if (reconnectTimer) {
    return;
  }

  const delayMs = getReconnectDelayMs(reconnectAttempt);
  reconnectAttempt = nextReconnectAttempt(reconnectAttempt);
  auditBaileys({
    level: "warning",
    category: "connection",
    code: "baileys.reconnect.scheduled",
    title: "WhatsApp reconnect scheduled",
    description: "A recoverable disconnect will be retried with bounded backoff.",
    metadata: {
      socketGeneration: closedGeneration,
      reconnectAttempt,
      delayMs,
    },
  });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    void initializeWhatsApp();
  }, delayMs);
  reconnectTimer.unref();
}

export async function initializeWhatsApp(): Promise<void> {
  if (reconnecting) {
    return;
  }

  reconnecting = true;
  markConnecting();
  clearReconnectTimer();
  const generation = ++socketGeneration;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDirectory);
    const nextSocket = makeWASocket({
      auth: state,
      getMessage: getRecentMessage,
      logger: baileysLogger,
    });

    socket = nextSocket;
    auditBaileys({
      level: "info",
      category: "connection",
      code: "baileys.socket.created",
      title: "WhatsApp socket created",
      description: "A new Baileys socket lifecycle started.",
      metadata: {
        socketGeneration: generation,
      },
    });

    nextSocket.ev.on("creds.update", () => {
      if (generation !== socketGeneration) {
        return;
      }

      enqueueCredentialWrite(saveCreds, generation);
    });

    nextSocket.ev.on("messages.update", (updates) => {
      if (generation !== socketGeneration) {
        return;
      }

      for (const entry of updates) {
        const messageId = entry.key?.id;

        if (!messageId || entry.update.status == null) {
          continue;
        }

        if (entry.update.status === WAMessageStatus.ERROR) {
          const mapped = mapMessageRejection(entry.update.messageStubParameters);
          logger.warn({
            event: "wa.message.rejected",
            messageId,
            reason: mapped.error,
          });
          auditBaileys({
            level: "warning",
            category: "messaging",
            code: "baileys.message.rejected",
            title: "WhatsApp rejected a message",
            description: "Baileys reported an outbound message rejection.",
            metadata: {
              socketGeneration: generation,
              status: entry.update.status,
              reason: mapped.error,
            },
          });

          if (mapped.error === "REACHOUT_RESTRICTED") {
            markReachoutRestricted();
            void refreshAccountHealth(makeAccountHealthFetcher(nextSocket, generation), { force: true });
          }

          updateMessageStatus(messageId, {
            status: "rejected",
            error: mapped.error,
            message: mapped.message,
          });
          continue;
        }

        if (entry.update.status >= WAMessageStatus.SERVER_ACK) {
          updateMessageStatus(messageId, {
            status: "accepted",
          });
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

    nextSocket.ev.on("connection.update", async (update) => {
      if (generation !== socketGeneration) {
        return;
      }

      if (update.qr) {
        markQr(update.qr);
        logger.info({
          event: "wa.connection",
          state: "qr",
        });
        auditBaileys({
          level: "info",
          category: "connection",
          code: "baileys.connection.qr_ready",
          title: "WhatsApp pairing QR is ready",
          description: "A pairing QR became available. The QR value is intentionally not persisted.",
          metadata: {
            socketGeneration: generation,
          },
        });
      }

      if (update.connection === "open") {
        const accountJid = nextSocket.user?.id;

        if (accountJid) {
          const binding = bindWhatsAppAccount(accountJid);
          logger.info({
            event: "wa.binding",
            state: "bound",
            account: maskIdentifier(binding.jid),
          });
        }

        markConnected();
        reconnectAttempt = resetReconnectAttempts();
        logger.info({
          event: "wa.connection",
          state: "connected",
        });
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
        void refreshAccountHealth(makeAccountHealthFetcher(nextSocket, generation), { force: true });
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
          rebindInProgress,
          shuttingDown,
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
            reconnectAttempt,
          },
        });

        markDisconnected();
        invalidateAccountHealth(classification.terminal ? "session_invalid" : "not_connected");

        if (socket === nextSocket) {
          socket = undefined;
        }
        socketGeneration += 1;

        if (classification.terminal && !rebindInProgress) {
          clearWhatsAppBinding();
          clearReconnectTimer();
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

        if (classification.shouldReconnect) {
          scheduleReconnect(generation);
        }
      }
    });
  } catch (error) {
    socket = undefined;
    markDisconnected();
    invalidateAccountHealth("not_connected");
    auditBaileys({
      level: "error",
      category: "connection",
      code: "baileys.socket.init_failed",
      title: "WhatsApp socket initialization failed",
      description: "Baileys could not initialize the WhatsApp socket.",
      metadata: {
        socketGeneration: generation,
        errorName: error instanceof Error ? error.name : "UNKNOWN",
      },
    });
    throw error;
  } finally {
    reconnecting = false;
  }
}

export async function resumeWhatsAppSession(): Promise<void> {
  if (!existsSync(credentialsFile)) {
    socket = undefined;
    clearWhatsAppBinding();
    markDisconnected();
    invalidateAccountHealth("session_invalid");
    auditBaileys({
      level: "warning",
      category: "connection",
      code: "baileys.session.auth_missing",
      title: "WhatsApp session credentials are missing",
      description: "No persisted Baileys credentials were found, so pairing is required.",
    });
    return;
  }

  await initializeWhatsApp();
}

export function getWhatsAppStatus(): WhatsAppStatusSnapshot {
  return getWhatsAppStatusSnapshot();
}

export function getCurrentQr(): { qr: string | null; status: WhatsAppStatus } {
  return getCurrentQrState();
}

export async function pairWhatsApp(): Promise<{ status: WhatsAppStatus }> {
  if (getWhatsAppBinding().state === "bound") {
    return { status: getConnectionStatus() };
  }

  const currentStatus = getConnectionStatus();

  if (reconnecting || currentStatus === "connecting" || currentStatus === "qr") {
    return { status: currentStatus };
  }

  await initializeWhatsApp();

  return { status: getConnectionStatus() };
}

export async function rebindWhatsApp(): Promise<{ status: WhatsAppStatus }> {
  if (rebindInProgress) {
    return { status: getConnectionStatus() };
  }

  const activeSocket = socket;
  const generation = socketGeneration;
  rebindInProgress = true;
  clearReconnectTimer();
  socketGeneration += 1;
  socket = undefined;
  clearWhatsAppBinding();
  invalidateAccountHealth("not_connected");
  markConnecting();
  auditBaileys({
    level: "warning",
    category: "connection",
    code: "baileys.session.rebind_started",
    title: "WhatsApp rebind started",
    description: "The existing WhatsApp session is being cleared before a new pairing.",
    metadata: {
      socketGeneration: generation,
    },
  });

  try {
    await flushCredentialWrites();

    if (activeSocket) {
      await activeSocket.logout("Rebinding WhatsApp session").catch(() => undefined);
    }

    await rm(authDirectory, { recursive: true, force: true });
    await mkdir(authDirectory, { recursive: true });
  } finally {
    rebindInProgress = false;
  }

  await initializeWhatsApp();
  auditBaileys({
    level: "info",
    category: "connection",
    code: "baileys.session.rebind_ready",
    title: "WhatsApp rebind reset completed",
    description: "The previous session was cleared and a fresh Baileys pairing lifecycle was started.",
    metadata: {
      socketGeneration,
    },
  });

  return { status: getConnectionStatus() };
}

export async function shutdownWhatsApp(): Promise<void> {
  shuttingDown = true;
  clearReconnectTimer();
  const activeSocket = socket;
  const generation = socketGeneration;
  socketGeneration += 1;
  socket = undefined;
  markDisconnected();
  invalidateAccountHealth("not_connected");
  auditBaileys({
    level: "info",
    category: "connection",
    code: "baileys.socket.shutdown",
    title: "WhatsApp socket shutdown",
    description: "Wago is shutting down the active Baileys socket without logging out the WhatsApp account.",
    metadata: {
      socketGeneration: generation,
      hadActiveSocket: Boolean(activeSocket),
    },
  });

  await flushCredentialWrites();

  try {
    activeSocket?.end(undefined);
  } catch (error) {
    logger.warn({ event: "wa.shutdown_socket_failed", error });
  }
}

export async function sendTextMessage(
  to: string,
  text: string,
  options: SendTextMessageOptions = {},
): Promise<SendTextMessageResult> {
  if (!socket || getConnectionStatus() !== "connected") {
    throw createNamedError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected");
  }

  const jid = toWhatsAppJid(to);
  const policyInput = {
    to,
    jid,
    text,
    idempotencyKey: options.idempotencyKey,
    accountHealthFetcher: makeAccountHealthFetcher(socket),
  };
  const policyDecision = await checkOutboundPolicy(policyInput);

  if (!policyDecision.allowed) {
    logger.warn({
      event: "wa.outbound.blocked",
      reason: policyDecision.reason,
      to: maskIdentifier(jid),
      retryAt: policyDecision.retryAt,
    });
    throw createOutboundPolicyError(policyDecision);
  }

  try {
    const resolvedJid = await resolveRecipientJid(socket, jid);
    const result = await socket.sendMessage(resolvedJid, { text });
    const messageId = result?.key?.id ?? null;

    if (messageId) {
      rememberRecentTextMessage(
        {
          id: messageId,
          remoteJid: resolvedJid,
        },
        text,
      );
      rememberPendingMessageStatus({
        id: messageId,
        to: resolvedJid,
      });
    }

    await recordOutboundAccepted(policyInput, messageId, resolvedJid);
    logger.info({
      event: "wa.outbound.accepted",
      messageId,
      to: maskIdentifier(resolvedJid),
    });

    return {
      messageId,
      status: "pending",
    };
  } catch (error) {
    recordOutboundRejected(policyInput, error);
    logger.warn({
      event: "wa.outbound.rejected",
      reason: error instanceof Error ? error.name : "UNKNOWN",
      to: maskIdentifier(jid),
    });

    if (error instanceof Error && error.name === "REACHOUT_RESTRICTED") {
      markReachoutRestricted();
      await refreshAccountHealth(makeAccountHealthFetcher(socket), { force: true });
      await markRecipientReachoutRestricted(jid, Date.now() + REACHOUT_RESTRICTION_COOLDOWN_MS);
    }

    throw error;
  }
}
