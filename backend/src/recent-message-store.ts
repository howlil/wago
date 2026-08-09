import { proto, type WAMessageKey } from "@whiskeysockets/baileys";

const RECENT_MESSAGE_TTL_MS = 1000 * 60 * 60;
const RECENT_MESSAGE_MAX_ENTRIES = 500;

type StoredRecentMessage = {
  message: proto.IMessage;
  expiresAt: number;
};

const recentMessages = new Map<string, StoredRecentMessage>();

function makeMessageKey(key: Pick<WAMessageKey, "id" | "remoteJid">): string | null {
  if (!key.id || !key.remoteJid) {
    return null;
  }

  return `${key.remoteJid}:${key.id}`;
}

function pruneExpiredMessages(now: number): void {
  for (const [key, value] of recentMessages) {
    if (value.expiresAt <= now) {
      recentMessages.delete(key);
    }
  }
}

function pruneOverflow(): void {
  while (recentMessages.size > RECENT_MESSAGE_MAX_ENTRIES) {
    const oldestKey = recentMessages.keys().next().value as string | undefined;

    if (!oldestKey) {
      return;
    }

    recentMessages.delete(oldestKey);
  }
}

export function rememberRecentTextMessage(key: Pick<WAMessageKey, "id" | "remoteJid">, text: string): void {
  const storeKey = makeMessageKey(key);

  if (!storeKey) {
    return;
  }

  const now = Date.now();
  pruneExpiredMessages(now);
  recentMessages.set(storeKey, {
    message: {
      conversation: text
    },
    expiresAt: now + RECENT_MESSAGE_TTL_MS
  });
  pruneOverflow();
}

export async function getRecentMessage(key: WAMessageKey): Promise<proto.IMessage | undefined> {
  const storeKey = makeMessageKey(key);

  if (!storeKey) {
    return undefined;
  }

  const stored = recentMessages.get(storeKey);

  if (!stored) {
    return undefined;
  }

  if (stored.expiresAt <= Date.now()) {
    recentMessages.delete(storeKey);
    return undefined;
  }

  return stored.message;
}

export function resetRecentMessageStoreForTest(): void {
  recentMessages.clear();
}
