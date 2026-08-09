import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WAMessageStatus,
  useMultiFileAuthState,
  type WASocket
} from "@whiskeysockets/baileys";
import { mkdir, rm } from "node:fs/promises";
import { config } from "./config.js";
import {
  checkOutboundPolicy,
  createOutboundPolicyError,
  recordOutboundAccepted,
  recordOutboundRejected
} from "./outbound-policy.js";
import { toWhatsAppJid } from "./utils/phone.js";

export type WhatsAppStatus = "connecting" | "qr" | "connected" | "disconnected";
export type MessageDeliveryStatus = "pending" | "accepted" | "rejected";
export type StoredMessageStatus = {
  id: string;
  to: string;
  status: MessageDeliveryStatus;
  error?: string;
  message?: string;
  updatedAt: string;
};
export type SendTextMessageOptions = {
  idempotencyKey?: string;
};

const MESSAGE_STATUS_TTL_MS = 1000 * 60 * 60;
const REACHOUT_RESTRICTION_COOLDOWN_MS = 1000 * 60 * 30;
const authDirectory = config.authDirectory;

let socket: WASocket | undefined;
let status: WhatsAppStatus = "disconnected";
let currentQr: string | null = null;
let reconnecting = false;
let rebindInProgress = false;
let socketGeneration = 0;
const messageStatuses = new Map<string, StoredMessageStatus>();
const reachoutRestrictedUntil = new Map<string, number>();

function createNamedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function nowIso(): string {
  return new Date().toISOString();
}

function rememberMessageStatus(statusEntry: StoredMessageStatus): void {
  messageStatuses.set(statusEntry.id, statusEntry);

  const expiresAt = Date.now() + MESSAGE_STATUS_TTL_MS;
  setTimeout(() => {
    const current = messageStatuses.get(statusEntry.id);

    if (current?.updatedAt === statusEntry.updatedAt && Date.now() >= expiresAt) {
      messageStatuses.delete(statusEntry.id);
    }
  }, MESSAGE_STATUS_TTL_MS).unref();
}

function updateMessageStatus(messageId: string, update: Partial<Omit<StoredMessageStatus, "id" | "to">>): void {
  const existing = messageStatuses.get(messageId);

  if (!existing) {
    return;
  }

  rememberMessageStatus({
    ...existing,
    ...update,
    updatedAt: nowIso()
  });
}

function mapMessageRejection(parameters?: string[] | null): { error: string; message: string } {
  const [code, detail] = parameters ?? [];

  if (code === "463") {
    return {
      error: "REACHOUT_RESTRICTED",
      message:
        "WhatsApp rejected the message because this account is restricted from starting this chat or the contact token is missing"
    };
  }

  return {
    error: "MESSAGE_REJECTED",
    message: detail ?? "WhatsApp rejected the message"
  };
}

export async function initializeWhatsApp(): Promise<void> {
  if (reconnecting) {
    return;
  }

  reconnecting = true;
  status = "connecting";
  const generation = ++socketGeneration;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDirectory);
    const { version } = await fetchLatestBaileysVersion();

    const nextSocket = makeWASocket({
      auth: state,
      version
    });

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
        currentQr = update.qr;
        status = "qr";
      }

      if (update.connection === "open") {
        currentQr = null;
        status = "connected";
      }

      if (update.connection === "close") {
        status = "disconnected";
        currentQr = null;

        const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
          ?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (!loggedOut && !rebindInProgress) {
          reconnecting = false;
          await initializeWhatsApp();
        }
      }
    });
  } finally {
    reconnecting = false;
  }
}

export function getWhatsAppStatus(): { status: WhatsAppStatus } {
  return { status };
}

export function getCurrentQr(): { qr: string | null; status: WhatsAppStatus } {
  return { qr: currentQr, status };
}

export async function rebindWhatsApp(): Promise<{ status: WhatsAppStatus }> {
  if (rebindInProgress) {
    return { status };
  }

  const activeSocket = socket;
  rebindInProgress = true;
  socketGeneration += 1;
  socket = undefined;
  currentQr = null;
  status = "connecting";

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

  return { status };
}

function waitForMessageOutcome(messageId: string, timeoutMs = 8000): Promise<"accepted"> {
  const activeSocket = socket;

  if (!activeSocket) {
    return Promise.resolve("accepted");
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      activeSocket.ev.off("messages.update", handleUpdate);
      resolve("accepted");
    }, timeoutMs);

    const handleUpdate = (updates: Array<{ key?: { id?: string | null }; update?: { status?: number | null; messageStubParameters?: string[] | null } }>) => {
      const match = updates.find((entry) => entry.key?.id === messageId);

      if (match?.update?.status == null) {
        return;
      }

      // Baileys represents ERROR as 0, so this must not use a falsy check.
      if (match.update.status === WAMessageStatus.ERROR) {
        clearTimeout(timer);
        activeSocket.ev.off("messages.update", handleUpdate);

        const mapped = mapMessageRejection(match.update.messageStubParameters);

        reject(createNamedError(mapped.error, mapped.message));
      }

      if (match.update.status >= WAMessageStatus.SERVER_ACK) {
        clearTimeout(timer);
        activeSocket.ev.off("messages.update", handleUpdate);
        resolve("accepted");
      }
    };

    activeSocket.ev.on("messages.update", handleUpdate);
  });
}

export async function sendTextMessage(
  to: string,
  text: string,
  options: SendTextMessageOptions = {}
): Promise<{ messageId: string | null; status: "accepted" }> {
  if (!socket || status !== "connected") {
    throw createNamedError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected");
  }

  const jid = toWhatsAppJid(to);
  const policyInput = {
    to,
    jid,
    text,
    idempotencyKey: options.idempotencyKey
  };
  const policyDecision = await checkOutboundPolicy(policyInput);

  if (!policyDecision.allowed) {
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
    const [contact] = (await socket.onWhatsApp(jid)) ?? [];

    if (!contact?.exists) {
      throw createNamedError("PHONE_NOT_ON_WHATSAPP", "Phone number is not registered on WhatsApp");
    }

    const result = await socket.sendMessage(contact.jid, { text });
    const messageId = result?.key?.id ?? null;

    if (messageId) {
      rememberMessageStatus({
        id: messageId,
        to: contact.jid,
        status: "pending",
        updatedAt: nowIso()
      });

      await waitForMessageOutcome(messageId);
    }

    recordOutboundAccepted(policyInput, messageId);

    return {
      messageId,
      status: "accepted"
    };
  } catch (error) {
    recordOutboundRejected(policyInput, error);

    if (error instanceof Error && error.name === "REACHOUT_RESTRICTED") {
      reachoutRestrictedUntil.set(jid, Date.now() + REACHOUT_RESTRICTION_COOLDOWN_MS);
    }

    throw error;
  }
}

export function getMessageStatus(messageId: string): StoredMessageStatus | null {
  return messageStatuses.get(messageId) ?? null;
}
