import type { WASocket } from "@whiskeysockets/baileys";
import { ApplicationError } from "../../errors/application-error.js";
import { rememberRecipientResolution } from "../recipients/store.js";
import { getRecipientIdentity, rememberRecipientIdentity } from "./recipient-identity-store.js";

const RECIPIENT_LOOKUP_POSITIVE_TTL_MS = 1000 * 60 * 60 * 24;
const RECIPIENT_LOOKUP_NEGATIVE_TTL_MS = 1000 * 60 * 5;

const recipientLookupCache = new Map<string, { exists: boolean; resolvedJid?: string; expiresAt: number }>();

function phoneNotOnWhatsAppError(): ApplicationError {
  return new ApplicationError("PHONE_NOT_ON_WHATSAPP", "Phone number is not registered on WhatsApp");
}

function cachePositive(jid: string, resolvedJid: string): void {
  recipientLookupCache.set(jid, {
    exists: true,
    resolvedJid,
    expiresAt: Date.now() + RECIPIENT_LOOKUP_POSITIVE_TTL_MS,
  });
}

export async function resolveRecipientJid(activeSocket: WASocket, jid: string): Promise<string> {
  const cached = recipientLookupCache.get(jid);

  if (cached && cached.expiresAt > Date.now()) {
    if (cached.exists && cached.resolvedJid) {
      return cached.resolvedJid;
    }

    throw phoneNotOnWhatsAppError();
  }

  const persistedIdentity = getRecipientIdentity(jid);
  if (persistedIdentity) {
    cachePositive(jid, persistedIdentity.lidJid);
    await rememberRecipientResolution(jid, persistedIdentity.lidJid);
    return persistedIdentity.lidJid;
  }

  const [contact] = (await activeSocket.onWhatsApp(jid)) ?? [];

  if (!contact?.exists) {
    recipientLookupCache.set(jid, {
      exists: false,
      expiresAt: Date.now() + RECIPIENT_LOOKUP_NEGATIVE_TTL_MS,
    });
    throw phoneNotOnWhatsAppError();
  }

  cachePositive(jid, contact.jid);
  if (jid.endsWith("@s.whatsapp.net") && contact.jid.endsWith("@lid")) {
    rememberRecipientIdentity(jid, contact.jid);
  }
  await rememberRecipientResolution(jid, contact.jid);

  return contact.jid;
}

export function invalidateRecipientLookupCache(jid?: string): void {
  if (jid) {
    recipientLookupCache.delete(jid);
    return;
  }
  recipientLookupCache.clear();
}

export function resetRecipientLookupCacheForTest(): void {
  recipientLookupCache.clear();
}
