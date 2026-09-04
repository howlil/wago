import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { ApplicationError } from "../../errors/application-error.js";
import { baileysLogger } from "../../infrastructure/logger.js";
import { type InboundMediaMessage, normalizeInboundMediaMessage } from "./inbound-message.js";
import { getRecentInboundMessage } from "./recent-inbound-store.js";
import { getActiveSocket } from "./runtime.js";

export type DownloadedInboundMedia = {
  data: Buffer;
  media: InboundMediaMessage["media"];
};

export async function downloadRecentInboundMedia(messageId: string): Promise<DownloadedInboundMedia> {
  const message = getRecentInboundMessage(messageId);
  const normalized = message ? normalizeInboundMediaMessage(message) : null;
  if (!message || !normalized) {
    throw new ApplicationError(
      "INBOUND_MEDIA_UNAVAILABLE",
      "Inbound media is unavailable because its bounded download context expired or was not retained",
    );
  }

  const socket = getActiveSocket();
  if (!socket) {
    throw new ApplicationError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected");
  }

  try {
    const data = await downloadMediaMessage(
      message,
      "buffer",
      {},
      {
        reuploadRequest: socket.updateMediaMessage,
        logger: baileysLogger,
      },
    );
    return { data, media: normalized.media };
  } catch (error) {
    throw new ApplicationError("MEDIA_DOWNLOAD_FAILED", "WhatsApp media download failed", { cause: error });
  }
}
