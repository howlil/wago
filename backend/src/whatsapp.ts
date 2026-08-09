import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WAMessageStatus,
  useMultiFileAuthState,
  type WASocket
} from "@whiskeysockets/baileys";
import { toWhatsAppJid } from "./utils/phone.js";

export type WhatsAppStatus = "connecting" | "qr" | "connected" | "disconnected";

let socket: WASocket | undefined;
let status: WhatsAppStatus = "disconnected";
let currentQr: string | null = null;
let reconnecting = false;

function createNamedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export async function initializeWhatsApp(): Promise<void> {
  if (reconnecting) {
    return;
  }

  reconnecting = true;
  status = "connecting";

  try {
    const { state, saveCreds } = await useMultiFileAuthState("./data/auth");
    const { version } = await fetchLatestBaileysVersion();

    socket = makeWASocket({
      auth: state,
      version
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async (update) => {
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

        if (!loggedOut) {
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

      if (!match?.update?.status) {
        return;
      }

      if (match.update.status === WAMessageStatus.ERROR) {
        clearTimeout(timer);
        activeSocket.ev.off("messages.update", handleUpdate);

        const [code, detail] = match.update.messageStubParameters ?? [];
        const message =
          code === "463"
            ? "WhatsApp rejected the message because this account is restricted from starting this chat or the contact token is missing"
            : detail ?? "WhatsApp rejected the message";

        reject(createNamedError("MESSAGE_REJECTED", message));
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

export async function sendTextMessage(to: string, text: string): Promise<{ messageId: string | null; status: "accepted" }> {
  if (!socket || status !== "connected") {
    throw createNamedError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected");
  }

  const jid = toWhatsAppJid(to);
  const [contact] = (await socket.onWhatsApp(jid)) ?? [];

  if (!contact?.exists) {
    throw createNamedError("PHONE_NOT_ON_WHATSAPP", "Phone number is not registered on WhatsApp");
  }

  const result = await socket.sendMessage(contact.jid, { text });
  const messageId = result?.key?.id ?? null;

  if (messageId) {
    await waitForMessageOutcome(messageId);
  }

  return {
    messageId,
    status: "accepted"
  };
}
