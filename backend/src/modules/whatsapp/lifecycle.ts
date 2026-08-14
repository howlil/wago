import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import makeWASocket, { useMultiFileAuthState, type WAVersion } from "@whiskeysockets/baileys";
import { config } from "../../config/index.js";
import { baileysLogger, logger } from "../../infrastructure/logger.js";
import { invalidateAccountHealth } from "./account-health.js";
import { clearWhatsAppBinding, getWhatsAppBinding } from "./binding-store.js";
import {
  getConnectionStatus,
  getCurrentQrState,
  getWhatsAppStatusSnapshot,
  markConnecting,
  markDisconnected,
  type WhatsAppStatus,
  type WhatsAppStatusSnapshot,
} from "./connection-state.js";
import { markCredentialPersistenceFailure, markCredentialPersistenceSuccess } from "./credential-persistence-health.js";
import { createCredentialWriter } from "./credential-writer.js";
import { auditBaileys } from "./observability.js";
import { getRecentMessage } from "./recent-message-store.js";
import { getReconnectDelayMs, nextReconnectAttempt, resetReconnectAttempts } from "./reconnect-state.js";
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
import { registerSocketEvents } from "./socket-events.js";
import { getLiveBaileysVersion } from "./wa-version.js";

export type { WhatsAppStatus, WhatsAppStatusSnapshot };

const authDirectory = config.authDirectory;
const credentialsFile = resolve(authDirectory, "creds.json");

let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | undefined;

const credentialWriter = createCredentialWriter({
  onSuccess: markCredentialPersistenceSuccess,
  onFailure: markCredentialPersistenceFailure,
  audit: auditBaileys,
  logFailure: (error) => {
    logger.error(
      { event: "wa.credentials.persist_failed", errorName: error instanceof Error ? error.name : "UNKNOWN" },
      "Failed to persist WhatsApp credentials",
    );
  },
});

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

    registerSocketEvents({
      socket: nextSocket,
      generation,
      saveCreds,
      credentialWriter,
      isCurrentGeneration,
      getReconnectAttempt: () => reconnectAttempt,
      resetReconnectAttempt: () => {
        reconnectAttempt = resetReconnectAttempts();
      },
      scheduleReconnect,
      clearReconnectTimer,
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
    await credentialWriter.flush();
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

  await credentialWriter.flush();

  try {
    activeSocket?.end(undefined);
  } catch (error) {
    logger.warn({ event: "wa.shutdown_socket_failed", errorName: error instanceof Error ? error.name : "UNKNOWN" });
  }
}
