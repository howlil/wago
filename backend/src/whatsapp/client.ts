import makeWASocket, {
  DisconnectReason,
  WAMessageStatus,
  useMultiFileAuthState,
  type WASocket,
  type WAVersion
} from "@whiskeysockets/baileys";
import { mkdir, rm } from "node:fs/promises";
import {
  markReachoutRestricted,
  refreshAccountHealth,
  updateReachoutTimeLock,
  type AccountHealthFetcher
} from "../account-health.js";
import { config } from "../config.js";
import { baileysLogger, logger, maskIdentifier } from "../logger.js";
import {
  checkOutboundPolicy,
  createOutboundPolicyError,
  recordOutboundAccepted,
  recordOutboundRejected
} from "../outbound-policy.js";
import { getReconnectDelayMs, nextReconnectAttempt, resetReconnectAttempts, shouldScheduleReconnect } from "../reconnect-state.js";
import { getRecentMessage, rememberRecentTextMessage } from "../recent-message-store.js";
import { toWhatsAppJid } from "../utils/phone.js";
import { getLiveBaileysVersion } from "../wa-version.js";
import {
  getConnectionStatus,
  getCurrentQrState,
  getWhatsAppStatusSnapshot,
  markConnected,
  markConnecting,
  markDisconnected,
  markQr,
  type WhatsAppStatus,
  type WhatsAppStatusSnapshot
} from "./connection-state.js";
import { mapMessageRejection } from "./message-rejection.js";
import { getMessageStatus, rememberPendingMessageStatus, updateMessageStatus } from "./message-status-store.js";
import { resolveRecipientJid } from "./recipient-cache.js";

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
const authDirectory = config.authDirectory;

let socket: WASocket | undefined;
let reconnecting = false;
let rebindInProgress = false;
let shuttingDown = false;
let socketGeneration = 0;
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | undefined;
const reachoutRestrictedUntil = new Map<string, number>();

type SocketOptions = {
  auth: Awaited<ReturnType<typeof useMultiFileAuthState>>["state"];
  getMessage: typeof getRecentMessage;
  logger: typeof baileysLogger;
  version?: WAVersion;
};

function createNamedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function makeAccountHealthFetcher(activeSocket: WASocket): AccountHealthFetcher {
  return {
    fetchAccountReachoutTimelock: () => activeSocket.fetchAccountReachoutTimelock(),
    fetchNewChatMessageCap: () => activeSocket.fetchNewChatMessageCap()
  };
}

function clearReconnectTimer(): void {
  if (!reconnectTimer) {
    return;
  }

  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
}

function scheduleReconnect(): void {
  if (reconnectTimer) {
    return;
  }

  const delayMs = getReconnectDelayMs(reconnectAttempt);
  reconnectAttempt = nextReconnectAttempt(reconnectAttempt);
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
    const socketOptions: SocketOptions = {
      auth: state,
      getMessage: getRecentMessage,
      logger: baileysLogger
    };

    if (config.waVersionMode === "live") {
      socketOptions.version = await getLiveBaileysVersion();
    }

    const nextSocket = makeWASocket(socketOptions);

    socket = nextSocket;

    nextSocket.ev.on("creds.update", async () => {
      if (generation !== socketGeneration) {
        return;
      }

      await saveCreds();
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
            reason: mapped.error
          });

          if (mapped.error === "REACHOUT_RESTRICTED") {
            markReachoutRestricted();
            void refreshAccountHealth(makeAccountHealthFetcher(nextSocket), { force: true });
          }

          updateMessageStatus(messageId, {
            status: "rejected",
            error: mapped.error,
            message: mapped.message
          });
          continue;
        }

        if (entry.update.status >= WAMessageStatus.SERVER_ACK) {
          updateMessageStatus(messageId, {
            status: "accepted"
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
          state: "qr"
        });
      }

      if (update.connection === "open") {
        markConnected();
        reconnectAttempt = resetReconnectAttempts();
        logger.info({
          event: "wa.connection",
          state: "connected"
        });
        void refreshAccountHealth(makeAccountHealthFetcher(nextSocket), { force: true });
      }

      if (update.reachoutTimeLock) {
        updateReachoutTimeLock(update.reachoutTimeLock);
        logger.warn({
          event: "wa.reachout_timelock",
          active: update.reachoutTimeLock.isActive,
          retryAt: update.reachoutTimeLock.timeEnforcementEnds
        });
      }

      if (update.connection === "close") {
        markDisconnected();

        const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
          ?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        logger.warn({
          event: "wa.connection",
          state: "disconnected",
          statusCode,
          loggedOut
        });

        if (
          shouldScheduleReconnect({
            loggedOut,
            rebindInProgress,
            shuttingDown
          })
        ) {
          scheduleReconnect();
        }
      }
    });
  } catch (error) {
    markDisconnected();
    throw error;
  } finally {
    reconnecting = false;
  }
}

export function getWhatsAppStatus(): WhatsAppStatusSnapshot {
  return getWhatsAppStatusSnapshot();
}

export function getCurrentQr(): { qr: string | null; status: WhatsAppStatus } {
  return getCurrentQrState();
}

export async function rebindWhatsApp(): Promise<{ status: WhatsAppStatus }> {
  if (rebindInProgress) {
    return { status: getConnectionStatus() };
  }

  const activeSocket = socket;
  rebindInProgress = true;
  clearReconnectTimer();
  socketGeneration += 1;
  socket = undefined;
  markConnecting();

  try {
    if (activeSocket) {
      await activeSocket.logout("Rebinding WhatsApp session").catch(() => undefined);
    }

    await rm(authDirectory, { recursive: true, force: true });
    await mkdir(authDirectory, { recursive: true });
  } finally {
    rebindInProgress = false;
  }

  await initializeWhatsApp();

  return { status: getConnectionStatus() };
}

export async function shutdownWhatsApp(): Promise<void> {
  shuttingDown = true;
  clearReconnectTimer();
  const activeSocket = socket;
  socketGeneration += 1;
  socket = undefined;
  markDisconnected();

  try {
    activeSocket?.end(undefined);
  } catch (error) {
    logger.warn({ event: "wa.shutdown_socket_failed", error });
  }
}

export async function sendTextMessage(
  to: string,
  text: string,
  options: SendTextMessageOptions = {}
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
    accountHealthFetcher: makeAccountHealthFetcher(socket)
  };
  const policyDecision = await checkOutboundPolicy(policyInput);

  if (!policyDecision.allowed) {
    logger.warn({
      event: "wa.outbound.blocked",
      reason: policyDecision.reason,
      to: maskIdentifier(jid),
      retryAt: policyDecision.retryAt
    });
    throw createOutboundPolicyError(policyDecision);
  }

  const restrictedUntil = reachoutRestrictedUntil.get(jid);

  if (restrictedUntil && restrictedUntil > Date.now()) {
    throw createNamedError(
      "REACHOUT_RESTRICTED",
      "WhatsApp recently rejected this chat as a restricted reach-out. Wait before trying this contact again."
    );
  }

  try {
    const resolvedJid = await resolveRecipientJid(socket, jid);
    const result = await socket.sendMessage(resolvedJid, { text });
    const messageId = result?.key?.id ?? null;

    if (messageId) {
      rememberRecentTextMessage(
        {
          id: messageId,
          remoteJid: resolvedJid
        },
        text
      );
      rememberPendingMessageStatus({
        id: messageId,
        to: resolvedJid
      });
    }

    recordOutboundAccepted(policyInput, messageId);
    logger.info({
      event: "wa.outbound.accepted",
      messageId,
      to: maskIdentifier(resolvedJid)
    });

    return {
      messageId,
      status: "pending"
    };
  } catch (error) {
    recordOutboundRejected(policyInput, error);
    logger.warn({
      event: "wa.outbound.rejected",
      reason: error instanceof Error ? error.name : "UNKNOWN",
      to: maskIdentifier(jid)
    });

    if (error instanceof Error && error.name === "REACHOUT_RESTRICTED") {
      markReachoutRestricted();
      await refreshAccountHealth(makeAccountHealthFetcher(socket), { force: true });
      reachoutRestrictedUntil.set(jid, Date.now() + REACHOUT_RESTRICTION_COOLDOWN_MS);
    }

    throw error;
  }
}
