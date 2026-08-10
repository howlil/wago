import type { WASocket } from "@whiskeysockets/baileys";
import { ApplicationError } from "../errors/application-error.js";
import { rememberRecipientResolution } from "../recipients/store.js";

const RECIPIENT_LOOKUP_POSITIVE_TTL_MS = 1000 * 60 * 60 * 24;
const RECIPIENT_LOOKUP_NEGATIVE_TTL_MS = 1000 * 60 * 5;

const recipientLookupCache = new Map<string, { exists: boolean; resolvedJid?: string; expiresAt: number }>();

function phoneNotOnWhatsAppError(): ApplicationError {
  return new ApplicationError("PHONE_NOT_ON_WHATSAPP", "Phone number is not registered on WhatsApp");
}

export async function resolveRecipientJid(activeSocket: WASocket, jid: string): Promise<string> {
  const cached = recipientLookupCache.get(jid);

  if (cached && cached.expiresAt > Date.now()) {
    if (cached.exists && cached.resolvedJid) {
      return cached.resolvedJid;
    }

    throw phoneNotOnWhatsAppError();
  }

  const [contact] = (await activeSocket.onWhatsApp(jid)) ?? [];

  if (!contact?.exists) {
    recipientLookupCache.set(jid, {
      exists: false,
      expiresAt: Date.now() + RECIPIENT_LOOKUP_NEGATIVE_TTL_MS,
    });
    throw phoneNotOnWhatsAppError();
  }

  recipientLookupCache.set(jid, {
    exists: true,
    resolvedJid: contact.jid,
    expiresAt: Date.now() + RECIPIENT_LOOKUP_POSITIVE_TTL_MS,
  });
  await rememberRecipientResolution(jid, contact.jid);

  return contact.jid;
}

export function resetRecipientLookupCacheForTest(): void {
  recipientLookupCache.clear();
}
