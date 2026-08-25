import type { WASocket } from "@whiskeysockets/baileys";
import { ApplicationError } from "../../errors/application-error.js";
import { rememberRecipientResolution } from "../recipients/store.js";

const RECIPIENT_LOOKUP_POSITIVE_TTL_MS = 1000 * 60 * 60 * 24;
const RECIPIENT_LOOKUP_NEGATIVE_TTL_MS = 1000 * 60 * 5;

const recipientLookupCache = new Map<string, { exists: boolean; resolvedJid?: string; expiresAt: number }>();

function recipientNotOnWhatsAppError(): ApplicationError {
  return new ApplicationError("RECIPIENT_NOT_ON_WHATSAPP", "Recipient is not registered on WhatsApp");
}

export async function resolveRecipientJid(activeSocket: WASocket, jid: string): Promise<string> {
  const cached = recipientLookupCache.get(jid);

  if (cached && cached.expiresAt > Date.now()) {
    if (cached.exists && cached.resolvedJid) {
      return cached.resolvedJid;
    }

    throw recipientNotOnWhatsAppError();
  }

  let contacts: Awaited<ReturnType<WASocket["onWhatsApp"]>>;
  try {
    contacts = await activeSocket.onWhatsApp(jid);
  } catch (error) {
    throw new ApplicationError("RECIPIENT_LOOKUP_FAILED", "Failed to resolve recipient with WhatsApp", {
      cause: error,
    });
  }

  const [contact] = contacts ?? [];
  if (!contact?.exists) {
    recipientLookupCache.set(jid, {
      exists: false,
      expiresAt: Date.now() + RECIPIENT_LOOKUP_NEGATIVE_TTL_MS,
    });
    throw recipientNotOnWhatsAppError();
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
