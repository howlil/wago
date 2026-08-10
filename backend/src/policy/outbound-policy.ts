import { ApplicationError, isApplicationError } from "../errors/application-error.js";
import { withTransaction } from "../infrastructure/database.js";
import { logger } from "../infrastructure/logger.js";
import { getRecipientByJid, getRecipientByJidSync, rememberSuccessfulOutboundSync } from "../recipients/store.js";
import {
  type AccountHealthFetcher,
  checkAccountHealth,
  resetAccountHealthForTest,
} from "../whatsapp/account-health.js";
import {
  flushOutboundPolicyStore,
  forgetOutboundPolicyMemoryForTest,
  getAccountWindow,
  getNewChatWindow,
  getOutboundPauseState,
  getRecipientReachoutCooldown,
  getRecipientWindow,
  isIdempotencyKeyActive,
  type PolicyWindow,
  pruneOutboundSafety,
  recordAcceptedOutbound,
  resetOutboundPolicyStoreForTest,
  setOutboundPause,
  setRecipientReachoutCooldown,
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

function checkPauseState(): OutboundPolicyDecision | undefined {
  const pause = getOutboundPauseState();

  if (!pause.paused) {
    return undefined;
  }

  return {
    allowed: false,
    reason: "OUTBOUND_PAUSED",
    message: pause.message,
  };
}

function checkIdempotency(idempotencyKey: string | undefined, now: number): OutboundPolicyDecision | undefined {
  if (!idempotencyKey || !isIdempotencyKeyActive(idempotencyKey, now)) {
    return undefined;
  }

  return {
    allowed: false,
    reason: "DUPLICATE_MESSAGE",
    message: `Message with idempotency key "${idempotencyKey}" was already sent`,
  };
}

async function getRecipientContext(jid: string): Promise<{
  decision?: OutboundPolicyDecision;
  isNewRecipient: boolean;
}> {
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

  return {
    isNewRecipient: !recipient.lastSuccessfulOutboundAt,
  };
}

function checkRecipientReachoutRestriction(jid: string, now: number): OutboundPolicyDecision | undefined {
  const restrictedUntil = getRecipientReachoutCooldown(jid, now);

  if (!restrictedUntil) {
    return undefined;
  }

  return {
    allowed: false,
    reason: "WA_REACHOUT_RESTRICTED",
    message: "WhatsApp recently rejected this chat as a restricted reach-out. Wait before trying this contact again.",
    retryAt: new Date(restrictedUntil),
  };
}

function rateLimitDecision(
  window: PolicyWindow,
  limit: number,
  windowMs: number,
  reason: "ACCOUNT_RATE_LIMITED" | "RECIPIENT_RATE_LIMITED" | "NEW_CHAT_RATE_LIMITED",
  message: string,
): OutboundPolicyDecision | undefined {
  if (window.count < limit) {
    return undefined;
  }

  return {
    allowed: false,
    reason,
    message,
    retryAt: new Date((window.oldest ?? Date.now()) + windowMs),
  };
}

function checkAccountRateLimit(now: number): OutboundPolicyDecision | undefined {
  return rateLimitDecision(
    getAccountWindow(now - ACCOUNT_WINDOW_MS),
    ACCOUNT_LIMIT,
    ACCOUNT_WINDOW_MS,
    "ACCOUNT_RATE_LIMITED",
    `Account send limit of ${ACCOUNT_LIMIT} messages per ${ACCOUNT_WINDOW_MS / 1000}s exceeded`,
  );
}

function checkRecipientRateLimit(jid: string, now: number): OutboundPolicyDecision | undefined {
  return rateLimitDecision(
    getRecipientWindow(jid, now - RECIPIENT_WINDOW_MS),
    RECIPIENT_LIMIT,
    RECIPIENT_WINDOW_MS,
    "RECIPIENT_RATE_LIMITED",
    `Recipient send limit of ${RECIPIENT_LIMIT} messages per ${RECIPIENT_WINDOW_MS / 1000}s exceeded`,
  );
}

function checkNewChatRateLimit(isNewRecipient: boolean, now: number): OutboundPolicyDecision | undefined {
  if (!isNewRecipient) {
    return undefined;
  }

  return rateLimitDecision(
    getNewChatWindow(now - NEW_CHAT_WINDOW_MS),
    NEW_CHAT_LIMIT,
    NEW_CHAT_WINDOW_MS,
    "NEW_CHAT_RATE_LIMITED",
    `New chat limit of ${NEW_CHAT_LIMIT} per ${NEW_CHAT_WINDOW_MS / 1000}s exceeded`,
  );
}

export async function checkOutboundPolicy(input: OutboundPolicyInput): Promise<OutboundPolicyDecision> {
  const now = Date.now();

  const pauseDecision = checkPauseState();
  if (pauseDecision) return pauseDecision;

  const idempotencyDecision = checkIdempotency(input.idempotencyKey, now);
  if (idempotencyDecision) return idempotencyDecision;

  const recipientContext = await getRecipientContext(input.jid);
  if (recipientContext.decision) return recipientContext.decision;

  const cooldownDecision = checkRecipientReachoutRestriction(input.jid, now);
  if (cooldownDecision) return cooldownDecision;

  const healthDecision = await checkAccountHealth(input.accountHealthFetcher, {
    isNewRecipient: recipientContext.isNewRecipient,
  });
  if (!healthDecision.allowed) return healthDecision;

  const accountLimitDecision = checkAccountRateLimit(now);
  if (accountLimitDecision) return accountLimitDecision;

  const recipientLimitDecision = checkRecipientRateLimit(input.jid, now);
  if (recipientLimitDecision) return recipientLimitDecision;

  const newChatLimitDecision = checkNewChatRateLimit(recipientContext.isNewRecipient, now);
  if (newChatLimitDecision) return newChatLimitDecision;

  return { allowed: true };
}

export async function recordOutboundAccepted(
  input: OutboundPolicyInput,
  _messageId: string | null,
  resolvedJid?: string,
): Promise<void> {
  const now = Date.now();
  const recipient = getRecipientByJidSync(input.jid);
  const isNewRecipient = !recipient?.lastSuccessfulOutboundAt;

  try {
    withTransaction(() => {
      recordAcceptedOutbound({
        jid: input.jid,
        acceptedAt: now,
        isNewRecipient,
        idempotencyKey: input.idempotencyKey,
        idempotencyExpiresAt: input.idempotencyKey ? now + IDEMPOTENCY_TTL_MS : undefined,
      });
      rememberSuccessfulOutboundSync(input.jid, resolvedJid);
      pruneOutboundSafety(now, now - NEW_CHAT_WINDOW_MS);
    });
  } catch (error) {
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
  setRecipientReachoutCooldown(jid, restrictedUntil);
}

export async function pauseOutbound(message?: string): Promise<void> {
  setOutboundPause(true, message || "Outbound messaging is paused");
}

export async function resumeOutbound(): Promise<void> {
  setOutboundPause(false);
}

export function isOutboundPaused(): boolean {
  return getOutboundPauseState().paused;
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

const outboundPolicyErrorCodes = new Set<OutboundPolicyBlockReason>([
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

export function createOutboundPolicyError(
  decision: Exclude<OutboundPolicyDecision, { allowed: true }>,
): ApplicationError {
  return new ApplicationError(decision.reason, decision.message, { retryAt: decision.retryAt });
}

export function isOutboundPolicyError(error: unknown): error is ApplicationError {
  return isApplicationError(error) && outboundPolicyErrorCodes.has(error.code as OutboundPolicyBlockReason);
}
