import type { WASocket } from "@whiskeysockets/baileys";
import { ApplicationError, isApplicationError } from "../../errors/application-error.js";
import { logger, maskIdentifier } from "../../infrastructure/logger.js";
import {
  checkOutboundPolicy,
  createOutboundPolicyError,
  markRecipientReachoutRestricted,
  recordOutboundAccepted,
  recordOutboundRejected,
} from "../../policy/outbound-policy.js";
import { toWhatsAppJid } from "../../utils/phone.js";
import { markReachoutRestricted, refreshAccountHealth } from "./account-health.js";
import { getConnectionStatus, type WhatsAppStatus } from "./connection-state.js";
import { rememberPendingMessageStatus } from "./message-status-store.js";
import { createAccountHealthFetcher } from "./observability.js";
import { rememberRecentTextMessage } from "./recent-message-store.js";
import { resolveRecipientJid } from "./recipient-cache.js";
import { getActiveSocket, getSocketGeneration } from "./runtime.js";

export type SendTextMessageOptions = {
  idempotencyKey?: string;
};

export type SendTextMessageResult = {
  messageId: string | null;
  status: "pending";
};

export type WhatsAppSenderDependencies = {
  getSocket: () => WASocket | undefined;
  getConnectionStatus: () => WhatsAppStatus;
};

const REACHOUT_RESTRICTION_COOLDOWN_MS = 1000 * 60 * 30;

function normalizeBaileysSendError(error: unknown): unknown {
  if (isApplicationError(error)) {
    return error;
  }

  if (error instanceof Error && error.name === "REACHOUT_RESTRICTED") {
    return new ApplicationError("REACHOUT_RESTRICTED", error.message, { cause: error });
  }

  if (error instanceof Error && error.name === "MESSAGE_REJECTED") {
    return new ApplicationError("MESSAGE_REJECTED", error.message, { cause: error });
  }

  return error;
}

export function createWhatsAppSender(deps: WhatsAppSenderDependencies) {
  return {
    async sendText(to: string, text: string, options: SendTextMessageOptions = {}): Promise<SendTextMessageResult> {
      const activeSocket = deps.getSocket();

      if (!activeSocket || deps.getConnectionStatus() !== "connected") {
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

      const generation = getSocketGeneration();
      const policyInput = {
        to,
        jid,
        text,
        idempotencyKey: options.idempotencyKey,
        accountHealthFetcher: createAccountHealthFetcher(activeSocket, generation),
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

      try {
        const resolvedJid = await resolveRecipientJid(activeSocket, jid);
        const result = await activeSocket.sendMessage(resolvedJid, { text });
        const messageId = result?.key?.id ?? null;

        if (messageId) {
          rememberRecentTextMessage(
            {
              id: messageId,
              remoteJid: resolvedJid,
            },
            text,
          );
          rememberPendingMessageStatus({
            id: messageId,
            to: resolvedJid,
          });
        }

        await recordOutboundAccepted(policyInput, messageId, resolvedJid);
        logger.info({
          event: "wa.outbound.accepted",
          messageId,
          to: maskIdentifier(resolvedJid),
        });

        return {
          messageId,
          status: "pending",
        };
      } catch (error) {
        const normalizedError = normalizeBaileysSendError(error);
        recordOutboundRejected(policyInput, normalizedError);
        logger.warn({
          event: "wa.outbound.rejected",
          reason: isApplicationError(normalizedError)
            ? normalizedError.code
            : normalizedError instanceof Error
              ? normalizedError.name
              : "UNKNOWN",
          to: maskIdentifier(jid),
        });

        if (isApplicationError(normalizedError) && normalizedError.code === "REACHOUT_RESTRICTED") {
          markReachoutRestricted();
          await refreshAccountHealth(createAccountHealthFetcher(activeSocket, generation), { force: true });
          await markRecipientReachoutRestricted(jid, Date.now() + REACHOUT_RESTRICTION_COOLDOWN_MS);
        }

        throw normalizedError;
      }
    },
  };
}

export const whatsappSender = createWhatsAppSender({
  getSocket: getActiveSocket,
  getConnectionStatus,
});

export function sendTextMessage(
  to: string,
  text: string,
  options?: SendTextMessageOptions,
): Promise<SendTextMessageResult> {
  return whatsappSender.sendText(to, text, options);
}
