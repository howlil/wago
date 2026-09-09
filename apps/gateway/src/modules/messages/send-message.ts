import {
  abandonOutboundDispatch,
  markOutboundDispatchIndeterminate,
  markOutboundDispatchSubmitted,
  markOutboundDispatchSubmitting,
  prepareOutboundDispatch,
} from "./outbound-dispatch.js";
import {
  checkOutboundPolicy,
  createOutboundPolicyError,
  type OutboundAccountHealthCheck,
  recordOutboundDispatched,
  recordOutboundRejected,
} from "./outbound-policy.js";

export type MessageTransportSubmitResult =
  | { kind: "submitted"; providerMessageId: string | null }
  | { kind: "rejected"; error: unknown }
  | { kind: "indeterminate"; error: unknown };

export type MessageTransport = {
  resolveRecipient(jid: string): Promise<string>;
  submit(resolvedJid: string): Promise<MessageTransportSubmitResult>;
};

export type ExecuteOutboundMessageInput = {
  messageId: string;
  to: string;
  jid: string;
  textForPolicy: string;
  idempotencyKey?: string;
  accountHealthCheck?: OutboundAccountHealthCheck;
  transport: MessageTransport;
};

export type ExecuteOutboundMessageResult = {
  messageId: string;
  status: "pending";
  transportOutcome: "submitted" | "indeterminate";
  resolvedJid: string;
  providerMessageId: string | null;
};

export async function executeOutboundMessage(
  input: ExecuteOutboundMessageInput,
): Promise<ExecuteOutboundMessageResult> {
  const policyInput = {
    to: input.to,
    jid: input.jid,
    text: input.textForPolicy,
    idempotencyKey: input.idempotencyKey,
    accountHealthCheck: input.accountHealthCheck,
  };

  const policyDecision = await checkOutboundPolicy(policyInput);
  if (!policyDecision.allowed) {
    throw createOutboundPolicyError(policyDecision);
  }

  let resolvedJid: string;
  try {
    resolvedJid = await input.transport.resolveRecipient(input.jid);
  } catch (error) {
    recordOutboundRejected(policyInput, error);
    throw error;
  }

  prepareOutboundDispatch({
    messageId: input.messageId,
    to: resolvedJid,
    recipientJid: input.jid,
    idempotencyKey: input.idempotencyKey,
  });

  try {
    markOutboundDispatchSubmitting(input.messageId);
  } catch (error) {
    abandonOutboundDispatch(input.messageId);
    throw error;
  }

  let result: MessageTransportSubmitResult;
  try {
    result = await input.transport.submit(resolvedJid);
  } catch (error) {
    result = { kind: "indeterminate", error };
  }

  if (result.kind === "rejected") {
    abandonOutboundDispatch(input.messageId);
    recordOutboundRejected(policyInput, result.error);
    throw result.error;
  }

  if (result.kind === "indeterminate") {
    markOutboundDispatchIndeterminate(input.messageId, "transport_failure");
    return {
      messageId: input.messageId,
      status: "pending",
      transportOutcome: "indeterminate",
      resolvedJid,
      providerMessageId: null,
    };
  }

  markOutboundDispatchSubmitted(input.messageId, result.providerMessageId);
  await recordOutboundDispatched(policyInput, input.messageId);

  return {
    messageId: input.messageId,
    status: "pending",
    transportOutcome: "submitted",
    resolvedJid,
    providerMessageId: result.providerMessageId,
  };
}
