import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import makeWASocket, { useMultiFileAuthState, WAMessageStatus, type WAVersion } from "@whiskeysockets/baileys";
import { config } from "../../config/index.js";
import { baileysLogger, logger, maskIdentifier } from "../../infrastructure/logger.js";
import {
  invalidateAccountHealth,
  markReachoutRestricted,
  refreshAccountHealth,
  updateReachoutTimeLock,
} from "../../whatsapp/account-health.js";
import { bindWhatsAppAccount, clearWhatsAppBinding, getWhatsAppBinding } from "../../whatsapp/binding-store.js";
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
} from "../../whatsapp/connection-state.js";
import {
  markCredentialPersistenceFailure,
  markCredentialPersistenceSuccess,
} from "../../whatsapp/credential-persistence-health.js";
import { classifyDisconnect } from "../../whatsapp/disconnect-classifier.js";
import { mapMessageRejection } from "../../whatsapp/message-rejection.js";
import { updateMessageStatus } from "../../whatsapp/message-status-store.js";
import { getRecentMessage } from "../../whatsapp/recent-message-store.js";
import { getReconnectDelayMs, nextReconnectAttempt, resetReconnectAttempts } from "../../whatsapp/reconnect-state.js";
import { getLiveBaileysVersion } from "../../whatsapp/wa-version.js";
import { auditBaileys, auditDate, createAccountHealthFetcher } from "./observability.js";
import {
  getActiveSocket,
  getSocketGeneration,
  invalidateSocketGeneration,
  isCurrentGeneration,
  isRebindInProgress,
  isReconnecting,
  isShuttingDown,
  nextSocketGeneration,
  setActiveSocket,
  setRebindInProgress,
  setReconnecting,
  setShuttingDown,
} from "./runtime.js";

export type { WhatsAppStatus, WhatsAppStatusSnapshot };

const CREDENTIAL_AUDIT_INTERVAL_MS = 1000 * 60;
const authDirectory = config.authDirectory;
const credentialsFile = resolve(authDirectory, "creds.json");

let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | undefined;
let credentialWriteQueue: Promise<void> = Promise.resolve();
let lastCredentialAuditGeneration = 0;
let lastCredentialAuditAt = 0;

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
        markCredentialPersistenceSuccess();
        const now = Date.now();
        if (shouldAuditCredentialSuccess(generation, now)) {
          auditBaileys({
            level: "info",
            category: "security",
            code: "baileys.credentials.persisted",
            title: "WhatsApp credentials persisted",
            description: "Updated Baileys credentials were persisted successfully.",
            metadata: { socketGeneration: generation },
          });
        }
      } catch (error) {
        markCredentialPersistenceFailure();
        logger.error(
          { event: "wa.credentials.persist_failed", errorName: error instanceof Error ? error.name : "UNKNOWN" },
          "Failed to persist WhatsApp credentials",
        );
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
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
}

function scheduleReconnect(closedGeneration: number): void {
  if (reconnectTimer || isShuttingDown()) return;

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
    void initializeWhatsApp().catch((error: unknown) => {
      logger.warn({ event: "wa.reconnect_failed", errorName: error instanceof Error ? error.name : "UNKNOWN" });
    });
  }, delayMs);
  reconnectTimer.unref();
}

export async function initializeWhatsApp(): Promise<void> {
  if (isReconnecting() || isShuttingDown()) return;

  setReconnecting(true);
  markConnecting();
  clearReconnectTimer();
  const generation = nextSocketGeneration();

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDirectory);
    if (!isCurrentGeneration(generation)) return;

    let version: WAVersion | undefined;
    try {
      version = await getLiveBaileysVersion();
      logger.info({ event: "wa.version.resolved", version: version.join(".") }, "Resolved WhatsApp Web version");
    } catch (error) {
      logger.warn(
        { event: "wa.version.lookup_failed", errorName: error instanceof Error ? error.name : "UNKNOWN" },
        "Could not resolve current WhatsApp Web version; using Baileys bundled version",
      );
      auditBaileys({
        level: "warning",
        category: "connection",
        code: "baileys.version.lookup_failed",
        title: "WhatsApp Web version lookup failed",
        description: "The gateway could not resolve the current WhatsApp Web version and will use Baileys defaults.",
        metadata: {
          socketGeneration: generation,
          errorName: error instanceof Error ? error.name : "UNKNOWN",
        },
      });
    }

    if (!isCurrentGeneration(generation)) return;

    const nextSocket = makeWASocket({
      auth: state,
      getMessage: getRecentMessage,
      logger: baileysLogger,
      ...(version ? { version } : {}),
    });

    setActiveSocket(nextSocket);
    auditBaileys({
      level: "info",
      category: "connection",
      code: "baileys.socket.created",
      title: "WhatsApp socket created",
      description: "A new Baileys socket lifecycle started.",
      metadata: { socketGeneration: generation },
    });

    nextSocket.ev.on("creds.update", () => {
      if (!isCurrentGeneration(generation)) return;
      enqueueCredentialWrite(saveCreds, generation);
    });

    nextSocket.ev.on("messages.update", (updates) => {
      if (!isCurrentGeneration(generation)) return;

      for (const entry of updates) {
        const messageId = entry.key?.id;
        if (!messageId || entry.update.status == null) continue;

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
            void refreshAccountHealth(createAccountHealthFetcher(nextSocket, generation), { force: true });
          }

          updateMessageStatus(messageId, {
            status: "rejected",
            error: mapped.code,
            message: mapped.message,
          });
          continue;
        }

        if (entry.update.status >= WAMessageStatus.SERVER_ACK) {
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

    nextSocket.ev.on("connection.update", (update) => {
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
        const accountJid = nextSocket.user?.id;
        if (accountJid) {
          const binding = bindWhatsAppAccount(accountJid);
          logger.info({ event: "wa.binding", state: "bound", account: maskIdentifier(binding.jid) });
        }

        markConnected();
        reconnectAttempt = resetReconnectAttempts();
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
        void refreshAccountHealth(createAccountHealthFetcher(nextSocket, generation), { force: true });
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
            reconnectAttempt,
          },
        });

        markDisconnected();
        invalidateAccountHealth(classification.terminal ? "session_invalid" : "not_connected");
        if (getActiveSocket() === nextSocket) setActiveSocket(undefined);
        invalidateSocketGeneration();

        if (classification.terminal && !isRebindInProgress()) {
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

        if (classification.shouldReconnect) scheduleReconnect(generation);
      }
    });
  } catch (error) {
    setActiveSocket(undefined);
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
    setReconnecting(false);
  }
}

export async function resumeWhatsAppSession(): Promise<void> {
  if (!existsSync(credentialsFile)) {
    setActiveSocket(undefined);
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

  try {
    await initializeWhatsApp();
  } catch (error) {
    setActiveSocket(undefined);
    markDisconnected();
    invalidateAccountHealth("session_invalid");
    logger.error(
      { event: "wa.session.resume_failed", errorName: error instanceof Error ? error.name : "UNKNOWN" },
      "Persisted WhatsApp session could not be resumed",
    );
    auditBaileys({
      level: "error",
      category: "connection",
      code: "baileys.session.resume_failed",
      title: "WhatsApp session resume failed",
      description:
        "Persisted Baileys authentication could not be resumed. The dashboard remains available for an explicit rebind.",
      metadata: { errorName: error instanceof Error ? error.name : "UNKNOWN" },
    });
  }
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
  if (isReconnecting() || currentStatus === "connecting" || currentStatus === "qr") {
    return { status: currentStatus };
  }

  await initializeWhatsApp();
  return { status: getConnectionStatus() };
}

export async function rebindWhatsApp(): Promise<{ status: WhatsAppStatus }> {
  if (isRebindInProgress()) {
    return { status: getConnectionStatus() };
  }

  const activeSocket = getActiveSocket();
  const generation = getSocketGeneration();
  setRebindInProgress(true);
  clearReconnectTimer();
  invalidateSocketGeneration();
  setActiveSocket(undefined);
  clearWhatsAppBinding();
  invalidateAccountHealth("not_connected");
  markConnecting();
  auditBaileys({
    level: "warning",
    category: "connection",
    code: "baileys.session.rebind_started",
    title: "WhatsApp rebind started",
    description: "The existing WhatsApp session is being cleared before a new pairing.",
    metadata: { socketGeneration: generation },
  });

  try {
    await flushCredentialWrites();
    if (activeSocket) await activeSocket.logout("Rebinding WhatsApp session").catch(() => undefined);
    await rm(authDirectory, { recursive: true, force: true });
    await mkdir(authDirectory, { recursive: true });
  } finally {
    setRebindInProgress(false);
  }

  await initializeWhatsApp();
  auditBaileys({
    level: "info",
    category: "connection",
    code: "baileys.session.rebind_ready",
    title: "WhatsApp rebind reset completed",
    description: "The previous session was cleared and a fresh Baileys pairing lifecycle was started.",
    metadata: { socketGeneration: getSocketGeneration() },
  });

  return { status: getConnectionStatus() };
}

export async function shutdownWhatsApp(): Promise<void> {
  setShuttingDown(true);
  clearReconnectTimer();
  const activeSocket = getActiveSocket();
  const generation = getSocketGeneration();
  invalidateSocketGeneration();
  setActiveSocket(undefined);
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
    logger.warn({ event: "wa.shutdown_socket_failed", errorName: error instanceof Error ? error.name : "UNKNOWN" });
  }
}
