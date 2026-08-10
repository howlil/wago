import { withTransaction } from "../infrastructure/database.js";
import { logger } from "../infrastructure/logger.js";
import { getRecipientByJid, rememberSuccessfulOutboundSync } from "../recipients/store.js";
import {
  type AccountHealthFetcher,
  checkAccountHealth,
  resetAccountHealthForTest,
} from "../whatsapp/account-health.js";
import {
  flushOutboundPolicyStore,
  forgetOutboundPolicyMemoryForTest,
  getOutboundPolicyState,
  mutateOutboundPolicyState,
  reloadOutboundPolicyState,
  type OutboundPolicyState,
  resetOutboundPolicyStoreForTest,
} from "./outbound-policy-store.js";

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

const IDEMPOTENCY_TTL_MS = 1000 * 60 * 60;
const ACCOUNT_WINDOW_MS = 1000 * 60;
const ACCOUNT_LIMIT = 30;
const RECIPIENT_WINDOW_MS = 1000 * 60;
const RECIPIENT_LIMIT = 5;
const NEW_CHAT_WINDOW_MS = 1000 * 60 * 60;
const NEW_CHAT_LIMIT = 10;

function pruneTimestamps(timestamps: number[], windowMs: number, now: number): void {
  while (timestamps.length > 0) {
    const oldestTimestamp = timestamps[0];

    if (oldestTimestamp === undefined || oldestTimestamp >= now - windowMs) {
      return;
    }

    timestamps.shift();
  }
}

function pruneIdempotencyKeys(state: OutboundPolicyState, now: number): void {
  for (const [key, expiresAt] of Object.entries(state.seenIdempotencyKeys)) {
    if (expiresAt <= now) {
      delete state.seenIdempotencyKeys[key];
    }
  }
}

function checkPauseState(state: OutboundPolicyState): OutboundPolicyDecision | undefined {
  if (!state.outboundPaused) {
    return undefined;
  }

  return {
    allowed: false,
    reason: "OUTBOUND_PAUSED",
    message: state.outboundPauseMessage,
  };
}

function checkIdempotency(
  state: OutboundPolicyState,
  idempotencyKey: string | undefined,
  now: number,
): OutboundPolicyDecision | undefined {
  if (!idempotencyKey) {
    return undefined;
  }

  pruneIdempotencyKeys(state, now);

  if (state.seenIdempotencyKeys[idempotencyKey]) {
    return {
      allowed: false,
      reason: "DUPLICATE_MESSAGE",
      message: `Message with idempotency key "${idempotencyKey}" was already sent`,
    };
  }
}

async function getRecipientContext(
  state: OutboundPolicyState,
  jid: string,
): Promise<{ decision?: OutboundPolicyDecision; isNewRecipient: boolean }> {
  const recipient = await getRecipientByJid(jid);

  if (!recipient?.allowed) {
    return {
      decision: {
        allowed: false,
        reason: "RECIPIENT_NOT_ALLOWED",
        message: "Recipient is not allowed for outbound messages",
      },
      isNewRecipient: true,
    };
  }

  if (recipient.optedOut) {
    return {
      decision: {
        allowed: false,
        reason: "RECIPIENT_OPTED_OUT",
        message: "Recipient has opted out of outbound messages",
      },
      isNewRecipient: true,
    };
  }

  if (!state.knownRecipients[jid] && recipient.lastSuccessfulOutboundAt) {
    const persistedTimestamp = Date.parse(recipient.lastSuccessfulOutboundAt);
    state.knownRecipients[jid] = Number.isFinite(persistedTimestamp) ? persistedTimestamp : Date.now();
  }

  return {
    isNewRecipient: !state.knownRecipients[jid],
  };
}

function checkRecipientReachoutCooldown(
  state: OutboundPolicyState,
  jid: string,
  now: number,
): OutboundPolicyDecision | undefined {
  const restrictedUntil = state.recipientReachoutCooldowns[jid];

  if (!restrictedUntil) {
    return undefined;
  }

  if (restrictedUntil <= now) {
    delete state.recipientReachoutCooldowns[jid];
    return undefined;
  }

  return {
    allowed: false,
    reason: "WA_REACHOUT_RESTRICTED",
    message: "WhatsApp recently rejected this chat as a restricted reach-out. Wait before trying this contact again.",
    retryAt: new Date(restrictedUntil),
  };
}

function checkAccountRateLimit(state: OutboundPolicyState, now: number): OutboundPolicyDecision | undefined {
  pruneTimestamps(state.accountSendTimestamps, ACCOUNT_WINDOW_MS, now);

  if (state.accountSendTimestamps.length >= ACCOUNT_LIMIT) {
    const oldestInWindow = state.accountSendTimestamps[0] ?? now;
    return {
      allowed: false,
      reason: "ACCOUNT_RATE_LIMITED",
      message: `Account send limit of ${ACCOUNT_LIMIT} messages per ${ACCOUNT_WINDOW_MS / 1000}s exceeded`,
      retryAt: new Date(oldestInWindow + ACCOUNT_WINDOW_MS),
    };
  }
}

function checkRecipientRateLimit(
  state: OutboundPolicyState,
  jid: string,
  now: number,
): OutboundPolicyDecision | undefined {
  const recipientTimestamps = state.recipientSendTimestamps[jid] ?? [];
  state.recipientSendTimestamps[jid] = recipientTimestamps;
  pruneTimestamps(recipientTimestamps, RECIPIENT_WINDOW_MS, now);

  if (recipientTimestamps.length >= RECIPIENT_LIMIT) {
    const oldestInWindow = recipientTimestamps[0] ?? now;
    return {
      allowed: false,
      reason: "RECIPIENT_RATE_LIMITED",
      message: `Recipient send limit of ${RECIPIENT_LIMIT} messages per ${RECIPIENT_WINDOW_MS / 1000}s exceeded`,
      retryAt: new Date(oldestInWindow + RECIPIENT_WINDOW_MS),
    };
  }
}

function checkNewChatRateLimit(
  state: OutboundPolicyState,
  isNewRecipient: boolean,
  now: number,
): OutboundPolicyDecision | undefined {
  if (!isNewRecipient) {
    return undefined;
  }

  pruneTimestamps(state.newChatTimestamps, NEW_CHAT_WINDOW_MS, now);

  if (state.newChatTimestamps.length >= NEW_CHAT_LIMIT) {
    const oldestInWindow = state.newChatTimestamps[0] ?? now;
    return {
      allowed: false,
      reason: "NEW_CHAT_RATE_LIMITED",
      message: `New chat limit of ${NEW_CHAT_LIMIT} per ${NEW_CHAT_WINDOW_MS / 1000}s exceeded`,
      retryAt: new Date(oldestInWindow + NEW_CHAT_WINDOW_MS),
    };
  }
}

export async function checkOutboundPolicy(input: OutboundPolicyInput): Promise<OutboundPolicyDecision> {
  const state = getOutboundPolicyState();
  const now = Date.now();

  const pauseDecision = checkPauseState(state);
  if (pauseDecision) return pauseDecision;

  const idempotencyDecision = checkIdempotency(state, input.idempotencyKey, now);
  if (idempotencyDecision) return idempotencyDecision;

  const recipientContext = await getRecipientContext(state, input.jid);
  if (recipientContext.decision) return recipientContext.decision;

  const cooldownDecision = checkRecipientReachoutCooldown(state, input.jid, now);
  if (cooldownDecision) return cooldownDecision;

  const healthDecision = await checkAccountHealth(input.accountHealthFetcher, {
    isNewRecipient: recipientContext.isNewRecipient,
  });
  if (!healthDecision.allowed) return healthDecision;

  const accountLimitDecision = checkAccountRateLimit(state, now);
  if (accountLimitDecision) return accountLimitDecision;

  const recipientLimitDecision = checkRecipientRateLimit(state, input.jid, now);
  if (recipientLimitDecision) return recipientLimitDecision;

  const newChatLimitDecision = checkNewChatRateLimit(state, recipientContext.isNewRecipient, now);
  if (newChatLimitDecision) return newChatLimitDecision;

  return { allowed: true };
}

export async function recordOutboundAccepted(
  input: OutboundPolicyInput,
  _messageId: string | null,
  resolvedJid?: string,
): Promise<void> {
  const now = Date.now();
  const wasKnown = Boolean(getOutboundPolicyState().knownRecipients[input.jid]);

  try {
    withTransaction(() => {
      mutateOutboundPolicyState((state) => {
        if (input.idempotencyKey) {
          state.seenIdempotencyKeys[input.idempotencyKey] = now + IDEMPOTENCY_TTL_MS;
        }

        state.accountSendTimestamps.push(now);
        const recipientTimestamps = state.recipientSendTimestamps[input.jid] ?? [];
        recipientTimestamps.push(now);
        state.recipientSendTimestamps[input.jid] = recipientTimestamps;

        if (!wasKnown) {
          state.newChatTimestamps.push(now);
        }
        state.knownRecipients[input.jid] = now;
      });
      rememberSuccessfulOutboundSync(input.jid, resolvedJid);
    });
  } catch (error) {
    reloadOutboundPolicyState();
    logger.error(
      { event: "outbound.persistence_failed", error },
      "Outbound message was sent but safety state could not be fully persisted",
    );
  }
}

export function recordOutboundRejected(_input: OutboundPolicyInput, _error: unknown): void {
  // Rejected sends are not counted toward rate limits and do not consume the
  // idempotency key, so a deliberate retry can proceed.
}

export async function markRecipientReachoutRestricted(jid: string, restrictedUntil: number): Promise<void> {
  const { persisted } = mutateOutboundPolicyState((state) => {
    state.recipientReachoutCooldowns[jid] = restrictedUntil;
  });
  await persisted;
}

export async function pauseOutbound(message?: string): Promise<void> {
  const { persisted } = mutateOutboundPolicyState((state) => {
    state.outboundPaused = true;
    state.outboundPauseMessage = message || "Outbound messaging is paused";
  });
  await persisted;
}

export async function resumeOutbound(): Promise<void> {
  const { persisted } = mutateOutboundPolicyState((state) => {
    state.outboundPaused = false;
    state.outboundPauseMessage = "Outbound messaging is paused";
  });
  await persisted;
}

export function isOutboundPaused(): boolean {
  return getOutboundPolicyState().outboundPaused;
}

export async function flushOutboundPolicyPersistence(): Promise<void> {
  await flushOutboundPolicyStore();
}

export async function forgetOutboundPolicyStateForTest(): Promise<void> {
  await forgetOutboundPolicyMemoryForTest();
  resetAccountHealthForTest();
}

export async function resetOutboundPolicyState(): Promise<void> {
  const persisted = resetOutboundPolicyStoreForTest();
  resetAccountHealthForTest();
  await persisted;
}

const outboundPolicyErrorNames = new Set<OutboundPolicyBlockReason>([
  "RECIPIENT_NOT_ALLOWED",
  "RECIPIENT_OPTED_OUT",
  "DUPLICATE_MESSAGE",
  "RECIPIENT_RATE_LIMITED",
  "ACCOUNT_RATE_LIMITED",
  "NEW_CHAT_RATE_LIMITED",
  "WA_REACHOUT_RESTRICTED",
  "WA_NEW_CHAT_CAPPED",
  "OUTBOUND_PAUSED",
]);

export function createOutboundPolicyError(decision: Exclude<OutboundPolicyDecision, { allowed: true }>): Error {
  const error = new Error(decision.message);
  error.name = decision.reason;

  if (decision.retryAt) {
    Object.defineProperty(error, "retryAt", {
      value: decision.retryAt,
      enumerable: true,
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
