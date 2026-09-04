import type { AnyMessageContent, WASocket } from "@whiskeysockets/baileys";
import { ApplicationError, isApplicationError } from "../../errors/application-error.js";
import { logger, maskIdentifier } from "../../infrastructure/logger.js";
import { toWhatsAppJid } from "../../utils/phone.js";
import {
  abandonOutboundDispatch,
  markOutboundDispatchIndeterminate,
  markOutboundDispatchSubmitted,
  markOutboundDispatchSubmitting,
  prepareOutboundDispatch,
} from "../messages/index.js";
import {
  checkOutboundPolicy,
  createOutboundPolicyError,
  markRecipientReachoutRestricted,
  recordOutboundDispatched,
  recordOutboundRejected,
} from "../messages/outbound-policy.js";
import { checkAccountHealth, markReachoutRestricted, refreshAccountHealth } from "./account-health.js";
import { getConnectionStatus, type WhatsAppStatus } from "./connection-state.js";
import { createAccountHealthFetcher } from "./observability.js";
import { getRecentInboundQuote } from "./recent-inbound-store.js";
import { rememberRecentTextMessage } from "./recent-message-store.js";
import { resolveRecipientJid } from "./recipient-cache.js";
import { getActiveSocket, getSocketGeneration } from "./runtime.js";

export type MessageContextOptions = {
  idempotencyKey?: string;
  messageId: string;
  replyToMessageId?: string;
};

export type SendTextMessageOptions = MessageContextOptions;

export type MediaKind = "image" | "video" | "audio" | "document";

export type SendMediaMessageInput = {
  kind: MediaKind;
  data: Buffer;
  mimetype: string;
  caption?: string;
  fileName?: string;
};

export type SendTextMessageResult = {
  messageId: string;
  status: "pending";
};

export type SendMediaMessageResult = SendTextMessageResult;

export type WhatsAppSenderDependencies = {
  getSocket: () => WASocket | undefined;
  getConnectionStatus: () => WhatsAppStatus;
};

let outboundCriticalSection: Promise<void> = Promise.resolve();

async function withOutboundCriticalSection<T>(operation: () => Promise<T>): Promise<T> {
  const previous = outboundCriticalSection;
  let release!: () => void;
  outboundCriticalSection = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function normalizeBaileysSendError(error: unknown): unknown {
  if (isApplicationError(error)) return error;

  if (error instanceof Error && error.name === "REACHOUT_RESTRICTED") {
    return new ApplicationError("REACHOUT_RESTRICTED", error.message, { cause: error });
  }

  if (error instanceof Error && error.name === "MESSAGE_REJECTED") {
    return new ApplicationError("MESSAGE_REJECTED", error.message, { cause: error });
  }

  return error;
}

function isDefinitiveTransportRejection(error: unknown): error is ApplicationError {
  return isApplicationError(error) && (error.code === "REACHOUT_RESTRICTED" || error.code === "MESSAGE_REJECTED");
}

function logicalPhoneFromJid(jid: string): string {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

function mediaContent(input: SendMediaMessageInput): AnyMessageContent {
  if (input.kind === "image") {
    return { image: input.data, mimetype: input.mimetype, ...(input.caption ? { caption: input.caption } : {}) };
  }
  if (input.kind === "video") {
    return { video: input.data, mimetype: input.mimetype, ...(input.caption ? { caption: input.caption } : {}) };
  }
  if (input.kind === "audio") {
    return { audio: input.data, mimetype: input.mimetype, ptt: false };
  }
  return {
    document: input.data,
    mimetype: input.mimetype,
    fileName: input.fileName ?? "attachment",
    ...(input.caption ? { caption: input.caption } : {}),
  };
}

async function handleOutboundFailure(input: {
  error: unknown;
  jid: string;
  messageId: string;
  policyInput: Parameters<typeof recordOutboundRejected>[0];
  accountHealthFetcher: ReturnType<typeof createAccountHealthFetcher>;
}): Promise<never> {
  const normalizedError = normalizeBaileysSendError(input.error);
  recordOutboundRejected(input.policyInput, normalizedError);
  logger.warn({
    event: "wa.outbound.rejected",
    messageId: input.messageId,
    reason: isApplicationError(normalizedError)
      ? normalizedError.code
      : normalizedError instanceof Error
        ? normalizedError.name
        : "UNKNOWN",
    to: maskIdentifier(input.jid),
  });

  if (isApplicationError(normalizedError) && normalizedError.code === "REACHOUT_RESTRICTED") {
    markReachoutRestricted();
    await refreshAccountHealth(input.accountHealthFetcher, { force: true });
    await markRecipientReachoutRestricted(input.jid);
  }

  throw normalizedError;
}

export function createWhatsAppSender(deps: WhatsAppSenderDependencies) {
  async function sendContent(
    to: string,
    content: AnyMessageContent,
    policyText: string,
    options: MessageContextOptions,
  ): Promise<SendTextMessageResult> {
    const initialSocket = deps.getSocket();
    if (!initialSocket || deps.getConnectionStatus() !== "connected") {
      throw new ApplicationError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected");
    }

    let jid: string;
    try {
      jid = toWhatsAppJid(to);
    } catch (error) {
      throw new ApplicationError("INVALID_PHONE", error instanceof Error ? error.message : "Invalid phone number", {
        cause: error,
      });
    }

    return withOutboundCriticalSection(async () => {
      const activeSocket = deps.getSocket();
      if (!activeSocket || deps.getConnectionStatus() !== "connected") {
        throw new ApplicationError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected");
      }

      const generation = getSocketGeneration();
      const accountHealthFetcher = createAccountHealthFetcher(activeSocket, generation);
      const policyInput = {
        to,
        jid,
        text: policyText,
        idempotencyKey: options.idempotencyKey,
        accountHealthCheck: ({ isNewRecipient }: { isNewRecipient: boolean }) =>
          checkAccountHealth(accountHealthFetcher, { isNewRecipient }),
      };
      const policyDecision = await checkOutboundPolicy(policyInput);

      if (!policyDecision.allowed) {
        logger.warn({
          event: "wa.outbound.blocked",
          reason: policyDecision.reason,
          to: maskIdentifier(jid),
          retryAt: policyDecision.retryAt,
        });
        throw createOutboundPolicyError(policyDecision);
      }

      let resolvedJid: string;
      try {
        resolvedJid = await resolveRecipientJid(activeSocket, jid);
      } catch (error) {
        return handleOutboundFailure({
          error,
          jid,
          messageId: options.messageId,
          policyInput,
          accountHealthFetcher,
        });
      }

      const quoted = options.replyToMessageId
        ? getRecentInboundQuote(options.replyToMessageId, logicalPhoneFromJid(jid))
        : null;
      if (options.replyToMessageId && !quoted) {
        throw new ApplicationError(
          "MESSAGE_CONTEXT_UNAVAILABLE",
          "Reply context is unavailable, expired, or belongs to a different recipient",
        );
      }

      prepareOutboundDispatch({
        messageId: options.messageId,
        to: resolvedJid,
        recipientJid: jid,
        idempotencyKey: options.idempotencyKey,
      });

      try {
        markOutboundDispatchSubmitting(options.messageId);
      } catch (error) {
        abandonOutboundDispatch(options.messageId);
        throw error;
      }

      let result: Awaited<ReturnType<WASocket["sendMessage"]>>;
      try {
        result = await activeSocket.sendMessage(resolvedJid, content, quoted ? { quoted } : undefined);
      } catch (error) {
        const normalizedError = normalizeBaileysSendError(error);
        if (isDefinitiveTransportRejection(normalizedError)) {
          abandonOutboundDispatch(options.messageId);
          return handleOutboundFailure({
            error: normalizedError,
            jid,
            messageId: options.messageId,
            policyInput,
            accountHealthFetcher,
          });
        }

        markOutboundDispatchIndeterminate(options.messageId, "transport_failure");
        logger.warn(
          {
            event: "wa.outbound.indeterminate",
            messageId: options.messageId,
            errorName: error instanceof Error ? error.name : "UNKNOWN",
            to: maskIdentifier(resolvedJid),
          },
          "WhatsApp transport outcome is indeterminate; automatic retry is suppressed",
        );

        return { messageId: options.messageId, status: "pending" };
      }

      const providerMessageId = result?.key?.id ?? null;
      markOutboundDispatchSubmitted(options.messageId, providerMessageId);
      await recordOutboundDispatched(policyInput, options.messageId);

      logger.info({
        event: "wa.outbound.submitted",
        messageId: options.messageId,
        providerMessageId,
        to: maskIdentifier(resolvedJid),
      });

      return { messageId: options.messageId, status: "pending" };
    });
  }

  return {
    async sendText(to: string, text: string, options: SendTextMessageOptions): Promise<SendTextMessageResult> {
      const result = await sendContent(to, { text }, text, options);
      const stored = options.messageId;
      // Keep Baileys' getMessage fallback for text sends without retaining durable chat content.
      // The provider id is resolved from the durable diagnostic after submission by existing event wiring.
      void stored;
      return result;
    },
    sendMedia(
      to: string,
      media: SendMediaMessageInput,
      options: MessageContextOptions,
    ): Promise<SendMediaMessageResult> {
      return sendContent(to, mediaContent(media), media.caption ?? `[${media.kind}]`, options);
    },
  };
}

export const whatsappSender = createWhatsAppSender({
  getSocket: getActiveSocket,
  getConnectionStatus,
});

export async function sendTextMessage(
  to: string,
  text: string,
  options: SendTextMessageOptions,
): Promise<SendTextMessageResult> {
  const result = await whatsappSender.sendText(to, text, options);
  const status = await import("../messages/message-status-store.js").then(({ getMessageStatus }) =>
    getMessageStatus(options.messageId),
  );
  if (status?.providerMessageId) {
    rememberRecentTextMessage({ id: status.providerMessageId, remoteJid: status.to }, text);
  }
  return result;
}

export function sendMediaMessage(
  to: string,
  media: SendMediaMessageInput,
  options: MessageContextOptions,
): Promise<SendMediaMessageResult> {
  return whatsappSender.sendMedia(to, media, options);
}
