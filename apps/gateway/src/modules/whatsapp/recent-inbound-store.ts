import type { WAMessage } from "@whiskeysockets/baileys";

const RECENT_INBOUND_TTL_MS = 60 * 60 * 1_000;
const RECENT_INBOUND_MAX_ENTRIES = 500;

type StoredRecentInbound = {
  message: WAMessage;
  from: string;
  expiresAt: number;
};

const recentInboundMessages = new Map<string, StoredRecentInbound>();

function pruneExpired(now: number): void {
  for (const [messageId, stored] of recentInboundMessages) {
    if (stored.expiresAt <= now) {
      recentInboundMessages.delete(messageId);
    }
  }
}

function pruneOverflow(): void {
  while (recentInboundMessages.size > RECENT_INBOUND_MAX_ENTRIES) {
    const oldestMessageId = recentInboundMessages.keys().next().value as string | undefined;
    if (!oldestMessageId) return;
    recentInboundMessages.delete(oldestMessageId);
  }
}

export function rememberRecentInboundMessage(messageId: string, from: string, message: WAMessage): void {
  const now = Date.now();
  pruneExpired(now);
  recentInboundMessages.set(messageId, {
    message,
    from,
    expiresAt: now + RECENT_INBOUND_TTL_MS,
  });
  pruneOverflow();
}

function getStored(messageId: string): StoredRecentInbound | null {
  const stored = recentInboundMessages.get(messageId);
  if (!stored) return null;

  if (stored.expiresAt <= Date.now()) {
    recentInboundMessages.delete(messageId);
    return null;
  }

  return stored;
}

export function getRecentInboundQuote(messageId: string, expectedFrom: string): WAMessage | null {
  const stored = getStored(messageId);
  if (!stored || stored.from !== expectedFrom) return null;
  return stored.message;
}

export function getRecentInboundMessage(messageId: string): WAMessage | null {
  return getStored(messageId)?.message ?? null;
}

export function resetRecentInboundStoreForTest(): void {
  recentInboundMessages.clear();
}
