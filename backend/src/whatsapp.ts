import { ApplicationError, type ApplicationErrorCode, isApplicationError } from "./errors/application-error.js";
import {
  type SendTextMessageOptions,
  type SendTextMessageResult,
  sendTextMessage as sendTextMessageInternal,
} from "./whatsapp/client.js";

export type { WhatsAppBinding } from "./whatsapp/binding-store.js";
export type { SendTextMessageOptions, SendTextMessageResult } from "./whatsapp/client.js";
export {
  getCurrentQr,
  getMessageStatus,
  getWhatsAppStatus,
  initializeWhatsApp,
  pairWhatsApp,
  rebindWhatsApp,
  resumeWhatsAppSession,
  shutdownWhatsApp,
  type WhatsAppStatus,
  type WhatsAppStatusSnapshot,
} from "./whatsapp/client.js";
export type { MessageDeliveryStatus, StoredMessageStatus } from "./whatsapp/message-status-store.js";

const legacySendErrorCodes = new Set<ApplicationErrorCode>([
  "WHATSAPP_NOT_CONNECTED",
  "MESSAGE_REJECTED",
  "REACHOUT_RESTRICTED",
]);

function normalizeSendError(error: unknown): never {
  if (isApplicationError(error)) {
    throw error;
  }

  if (error instanceof Error && legacySendErrorCodes.has(error.name as ApplicationErrorCode)) {
    throw new ApplicationError(error.name as ApplicationErrorCode, error.message, { cause: error });
  }

  throw error;
}

export async function sendTextMessage(
  to: string,
  text: string,
  options?: SendTextMessageOptions,
): Promise<SendTextMessageResult> {
  try {
    return await sendTextMessageInternal(to, text, options);
  } catch (error) {
    return normalizeSendError(error);
  }
}
