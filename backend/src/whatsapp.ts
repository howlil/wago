import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket
} from "@whiskeysockets/baileys";
import { toWhatsAppJid } from "./utils/phone.js";

export type WhatsAppStatus = "connecting" | "qr" | "connected" | "disconnected";

let socket: WASocket | undefined;
let status: WhatsAppStatus = "disconnected";
let currentQr: string | null = null;
let reconnecting = false;

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

export async function sendTextMessage(to: string, text: string): Promise<{ messageId: string | null }> {
  if (!socket || status !== "connected") {
    const error = new Error("WhatsApp is not connected");
    error.name = "WHATSAPP_NOT_CONNECTED";
    throw error;
  }

  const result = await socket.sendMessage(toWhatsAppJid(to), { text });

  return {
    messageId: result?.key?.id ?? null
  };
}
