import { createHash } from "node:crypto";
import { normalizeMessageContent, type WAMessage } from "@whiskeysockets/baileys";

export type InboundTextMessage = {
  messageId: string;
  from: string;
  text: string;
  receivedAt: string;
};

function directPhoneJid(message: WAMessage): string | null {
  const candidates = [message.key.remoteJidAlt, message.key.remoteJid];
  return candidates.find((jid): jid is string => Boolean(jid?.endsWith("@s.whatsapp.net"))) ?? null;
}

function senderFromPhoneJid(jid: string): string | null {
  const local = jid.slice(0, -"@s.whatsapp.net".length).split(":", 1)[0]?.trim();
  return local || null;
}

function inboundMessageId(phoneJid: string, providerMessageId: string): string {
  const digest = createHash("sha256").update(`${phoneJid}:${providerMessageId}`).digest("hex").slice(0, 32);
  return `in_${digest}`;
}

export function normalizeInboundTextMessage(
  message: WAMessage,
  now: () => Date = () => new Date(),
): InboundTextMessage | null {
  if (message.key.fromMe) return null;

  const providerMessageId = message.key.id?.trim();
  if (!providerMessageId) return null;

  const phoneJid = directPhoneJid(message);
  if (!phoneJid) return null;

  const from = senderFromPhoneJid(phoneJid);
  if (!from) return null;

  const content = normalizeMessageContent(message.message);
  const text = content?.conversation ?? content?.extendedTextMessage?.text ?? null;
  if (typeof text !== "string" || text.trim().length === 0) return null;

  return {
    messageId: inboundMessageId(phoneJid, providerMessageId),
    from,
    text,
    receivedAt: now().toISOString(),
  };
}
