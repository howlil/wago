import { checkAccountHealth, resetAccountHealthForTest, type AccountHealthFetcher } from "./account-health.js";
import { getRecipientByJid } from "./recipient-store.js";

export type OutboundPolicyBlockReason =
  | "RECIPIENT_NOT_ALLOWED"
  | "RECIPIENT_OPTED_OUT"
  | "DUPLICATE_MESSAGE"
  | "RECIPIENT_RATE_LIMITED"
  | "ACCOUNT_RATE_LIMITED"
  | "NEW_CHAT_RATE_LIMITED"
  | "WA_REACHOUT_RESTRICTED"
  | "WA_NEW_CHAT_CAPPED"
  | "OUTBOUND_PAUSED";

export type OutboundPolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: OutboundPolicyBlockReason;
      message: string;
      retryAt?: Date;
    };

export type OutboundPolicyInput = {
  to: string;
  jid: string;
  text: string;
  idempotencyKey?: string;
  accountHealthFetcher?: AccountHealthFetcher;
};

export type OutboundPolicyOutcome = OutboundPolicyInput & {
  messageId?: string | null;
  error?: string;
};

// --- Configuration defaults ---

const IDEMPOTENCY_TTL_MS = 1000 * 60 * 60; // 1 hour
const ACCOUNT_WINDOW_MS = 1000 * 60; // 1 minute
const ACCOUNT_LIMIT = 30; // max sends per window
const RECIPIENT_WINDOW_MS = 1000 * 60; // 1 minute
const RECIPIENT_LIMIT = 5; // max sends per recipient per window
const NEW_CHAT_WINDOW_MS = 1000 * 60 * 60; // 1 hour
const NEW_CHAT_LIMIT = 10; // max new chats per window

// --- In-memory state ---

/** Idempotency keys seen recently, mapped to expiry timestamp */
const seenIdempotencyKeys = new Map<string, number>();

/** Account-level send timestamps within the sliding window */
const accountSendTimestamps: number[] = [];

/** Per-recipient send timestamps within the sliding window */
const recipientSendTimestamps = new Map<string, number[]>();

/** Recipients we have previously sent to successfully (known contacts) */
const knownRecipients = new Set<string>();

/** Timestamps of new-chat initiations (first message to unknown recipient) */
const newChatTimestamps: number[] = [];

/** Outbound pause state */
let outboundPaused = false;
let outboundPauseMessage = "Outbound messaging is paused";

// --- Cleanup helpers ---

function pruneTimestamps(timestamps: number[], windowMs: number, now: number): void {
  while (timestamps.length > 0 && timestamps[0]! < now - windowMs) {
    timestamps.shift();
  }
}

function pruneIdempotencyKeys(now: number): void {
  for (const [key, expiresAt] of seenIdempotencyKeys) {
    if (expiresAt <= now) {
      seenIdempotencyKeys.delete(key);
    }
  }
}

// --- Public API: Policy check ---

export async function checkOutboundPolicy(input: OutboundPolicyInput): Promise<OutboundPolicyDecision> {
  const now = Date.now();

  // 1. Outbound pause - blocks everything
  if (outboundPaused) {
    return {
      allowed: false,
      reason: "OUTBOUND_PAUSED",
      message: outboundPauseMessage
    };
  }

  // 2. Idempotency - block duplicate sends
  if (input.idempotencyKey) {
    pruneIdempotencyKeys(now);

    if (seenIdempotencyKeys.has(input.idempotencyKey)) {
      return {
        allowed: false,
        reason: "DUPLICATE_MESSAGE",
        message: `Message with idempotency key "${input.idempotencyKey}" was already sent`
      };
    }
  }

  // 3. Recipient consent and opt-out
  const recipient = await getRecipientByJid(input.jid);

  if (!recipient?.allowed) {
    return {
      allowed: false,
      reason: "RECIPIENT_NOT_ALLOWED",
      message: "Recipient is not allowed for outbound messages"
    };
  }

  if (recipient.optedOut) {
    return {
      allowed: false,
      reason: "RECIPIENT_OPTED_OUT",
      message: "Recipient has opted out of outbound messages"
    };
  }

  const isNewRecipient = !knownRecipients.has(input.jid);
  const healthDecision = await checkAccountHealth(input.accountHealthFetcher, { isNewRecipient });

  if (!healthDecision.allowed) {
    return healthDecision;
  }

  // 4. Account rate limit
  pruneTimestamps(accountSendTimestamps, ACCOUNT_WINDOW_MS, now);

  if (accountSendTimestamps.length >= ACCOUNT_LIMIT) {
    const oldestInWindow = accountSendTimestamps[0]!;
    return {
      allowed: false,
      reason: "ACCOUNT_RATE_LIMITED",
      message: `Account send limit of ${ACCOUNT_LIMIT} messages per ${ACCOUNT_WINDOW_MS / 1000}s exceeded`,
      retryAt: new Date(oldestInWindow + ACCOUNT_WINDOW_MS)
    };
  }

  // 5. Recipient rate limit
  const recipientTimestamps = recipientSendTimestamps.get(input.jid) ?? [];
  pruneTimestamps(recipientTimestamps, RECIPIENT_WINDOW_MS, now);

  if (recipientTimestamps.length >= RECIPIENT_LIMIT) {
    const oldestInWindow = recipientTimestamps[0]!;
    return {
      allowed: false,
      reason: "RECIPIENT_RATE_LIMITED",
      message: `Recipient send limit of ${RECIPIENT_LIMIT} messages per ${RECIPIENT_WINDOW_MS / 1000}s exceeded`,
      retryAt: new Date(oldestInWindow + RECIPIENT_WINDOW_MS)
    };
  }

  // 6. New-chat rate limit - only for recipients we have not sent to before
  if (isNewRecipient) {
    pruneTimestamps(newChatTimestamps, NEW_CHAT_WINDOW_MS, now);

    if (newChatTimestamps.length >= NEW_CHAT_LIMIT) {
      const oldestInWindow = newChatTimestamps[0]!;
      return {
        allowed: false,
        reason: "NEW_CHAT_RATE_LIMITED",
        message: `New chat limit of ${NEW_CHAT_LIMIT} per ${NEW_CHAT_WINDOW_MS / 1000}s exceeded`,
        retryAt: new Date(oldestInWindow + NEW_CHAT_WINDOW_MS)
      };
    }
  }

  return { allowed: true };
}

// --- Public API: Record outcomes ---

export function recordOutboundAccepted(input: OutboundPolicyInput, _messageId: string | null): void {
  const now = Date.now();

  // Mark idempotency key as used
  if (input.idempotencyKey) {
    seenIdempotencyKeys.set(input.idempotencyKey, now + IDEMPOTENCY_TTL_MS);
  }

  // Record account-level send
  accountSendTimestamps.push(now);
 
  // Record per-recipient send
  let timestamps = recipientSendTimestamps.get(input.jid);
  if (!timestamps) {
    timestamps = [];
    recipientSendTimestamps.set(input.jid, timestamps);
  }
  timestamps.push(now);

  // Track new chat initiation
  if (!knownRecipients.has(input.jid)) {
    newChatTimestamps.push(now);
    knownRecipients.add(input.jid);
  }
}

export function recordOutboundRejected(_input: OutboundPolicyInput, _error: unknown): void {
  // Rejected sends are not counted toward rate limits.
  // Idempotency key is NOT consumed on rejection, so retries can proceed.
  return;
}

// --- Public API: Pause/resume ---

export function pauseOutbound(message?: string): void {
  outboundPaused = true;
  if (message) {
    outboundPauseMessage = message;
  }
}

export function resumeOutbound(): void {
  outboundPaused = false;
  outboundPauseMessage = "Outbound messaging is paused";
}

export function isOutboundPaused(): boolean {
  return outboundPaused;
}

// --- Public API: State reset (for testing) ---

export function resetOutboundPolicyState(): void {
  seenIdempotencyKeys.clear();
  accountSendTimestamps.length = 0;
  recipientSendTimestamps.clear();
  knownRecipients.clear();
  newChatTimestamps.length = 0;
  outboundPaused = false;
  outboundPauseMessage = "Outbound messaging is paused";
  resetAccountHealthForTest();
}

// --- Helpers (unchanged from original) ---

const outboundPolicyErrorNames = new Set<OutboundPolicyBlockReason>([
  "RECIPIENT_NOT_ALLOWED",
  "RECIPIENT_OPTED_OUT",
  "DUPLICATE_MESSAGE",
  "RECIPIENT_RATE_LIMITED",
  "ACCOUNT_RATE_LIMITED",
  "NEW_CHAT_RATE_LIMITED",
  "WA_REACHOUT_RESTRICTED",
  "WA_NEW_CHAT_CAPPED",
  "OUTBOUND_PAUSED"
]);

export function createOutboundPolicyError(decision: Exclude<OutboundPolicyDecision, { allowed: true }>): Error {
  const error = new Error(decision.message);
  error.name = decision.reason;

  if (decision.retryAt) {
    Object.defineProperty(error, "retryAt", {
      value: decision.retryAt,
      enumerable: true
    });
  }

  return error;
}

export function isOutboundPolicyError(error: unknown): error is Error {
  return error instanceof Error && outboundPolicyErrorNames.has(error.name as OutboundPolicyBlockReason);
}

export function getOutboundPolicyHttpStatus(reason: OutboundPolicyBlockReason): number {
  if (reason === "DUPLICATE_MESSAGE") {
    return 409;
  }

  if (reason === "RECIPIENT_NOT_ALLOWED" || reason === "RECIPIENT_OPTED_OUT") {
    return 403;
  }

  if (reason === "OUTBOUND_PAUSED") {
    return 503;
  }

  return 429;
}
