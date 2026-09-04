import { createHash } from "node:crypto";
import { jidDecode, normalizeMessageContent, type WAMessage } from "@whiskeysockets/baileys";

export type InboundTextMessage = {
  messageId: string;
  from: string;
  text: string;
  receivedAt: string;
  quotedProviderMessageId?: string;
};

export type InboundMediaKind = "image" | "video" | "audio" | "document";

export type InboundMediaMessage = {
  messageId: string;
  from: string;
  receivedAt: string;
  quotedProviderMessageId?: string;
  media: {
    kind: InboundMediaKind;
    mimetype?: string;
    fileName?: string;
    fileLength?: number;
    caption?: string;
    seconds?: number;
    width?: number;
    height?: number;
  };
};

function logicalPhoneJid(message: WAMessage): string | null {
  const primary = message.key.remoteJid;
  const alternate = message.key.remoteJidAlt;
  const candidate = primary?.endsWith("@lid") || primary?.endsWith("@hosted.lid") ? alternate : primary;
  if (!candidate || (!candidate.endsWith("@s.whatsapp.net") && !candidate.endsWith("@hosted"))) return null;
  return candidate;
}

function logicalPhone(jid: string): string | null {
  const decoded = jidDecode(jid);
  if (!decoded?.user) return null;
  return decoded.user;
}

function stableInboundMessageId(from: string, providerMessageId: string): string {
  return `in_${createHash("sha256").update(`${from}:${providerMessageId}`).digest("hex").slice(0, 32)}`;
}

function messageTimestamp(message: WAMessage, now: () => Date): string {
  const value = Number(message.messageTimestamp);
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : now().toISOString();
}

function numeric(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function commonInbound(message: WAMessage, now: () => Date) {
  if (message.key.fromMe) return null;
  const jid = logicalPhoneJid(message);
  const providerMessageId = message.key.id;
  if (!jid || !providerMessageId) return null;
  const from = logicalPhone(jid);
  if (!from) return null;

  return {
    messageId: stableInboundMessageId(from, providerMessageId),
    from,
    receivedAt: messageTimestamp(message, now),
  };
}

export function normalizeInboundTextMessage(
  message: WAMessage,
  now: () => Date = () => new Date(),
): InboundTextMessage | null {
  const common = commonInbound(message, now);
  if (!common) return null;

  const content = normalizeMessageContent(message.message);
  const text = content?.conversation ?? content?.extendedTextMessage?.text;
  if (!text?.trim()) return null;
  const quotedProviderMessageId = content?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined;

  return {
    ...common,
    text: text.trim(),
    ...(quotedProviderMessageId ? { quotedProviderMessageId } : {}),
  };
}

export function normalizeInboundMediaMessage(
  message: WAMessage,
  now: () => Date = () => new Date(),
): InboundMediaMessage | null {
  const common = commonInbound(message, now);
  if (!common) return null;

  const content = normalizeMessageContent(message.message);
  const media = content?.imageMessage ?? content?.videoMessage ?? content?.audioMessage ?? content?.documentMessage;
  if (!media) return null;

  const kind: InboundMediaKind = content?.imageMessage
    ? "image"
    : content?.videoMessage
      ? "video"
      : content?.audioMessage
        ? "audio"
        : "document";
  const quotedProviderMessageId = media.contextInfo?.stanzaId ?? undefined;

  return {
    ...common,
    ...(quotedProviderMessageId ? { quotedProviderMessageId } : {}),
    media: {
      kind,
      ...(media.mimetype ? { mimetype: media.mimetype } : {}),
      ...(content?.documentMessage?.fileName ? { fileName: content.documentMessage.fileName } : {}),
      ...(numeric(media.fileLength) !== undefined ? { fileLength: numeric(media.fileLength) } : {}),
      ...("caption" in media && media.caption ? { caption: media.caption } : {}),
      ...(numeric("seconds" in media ? media.seconds : undefined) !== undefined
        ? { seconds: numeric("seconds" in media ? media.seconds : undefined) }
        : {}),
      ...(numeric("width" in media ? media.width : undefined) !== undefined
        ? { width: numeric("width" in media ? media.width : undefined) }
        : {}),
      ...(numeric("height" in media ? media.height : undefined) !== undefined
        ? { height: numeric("height" in media ? media.height : undefined) }
        : {}),
    },
  };
}
