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
};

export type OutboundPolicyOutcome = OutboundPolicyInput & {
  messageId?: string | null;
  error?: string;
};

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

export async function checkOutboundPolicy(_input: OutboundPolicyInput): Promise<OutboundPolicyDecision> {
  return { allowed: true };
}

export function recordOutboundAccepted(_input: OutboundPolicyInput, _messageId: string | null): void {
  return;
}

export function recordOutboundRejected(_input: OutboundPolicyInput, _error: unknown): void {
  return;
}

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
