import { ApplicationError, isApplicationError } from "../../errors/application-error.js";
import { getDatabase, withTransaction } from "../../infrastructure/database.js";
import { logger } from "../../infrastructure/logger.js";
import { recordActivity } from "../activity/store.js";
import {
  deletePendingMessageStatus,
  listPendingMessagesByDispatchState,
  markMessageIndeterminate,
  markMessageSubmitted,
  markMessageSubmitting,
  prepareMessageStatus,
} from "./message-status-store.js";

const IDEMPOTENCY_TTL_MS = 60 * 60 * 1_000;
const database = getDatabase();

const deleteExpiredReservation = database.prepare("DELETE FROM idempotency_keys WHERE key = ? AND expires_at <= ?");
const reserveIdempotencyKey = database.prepare(`
  INSERT OR IGNORE INTO idempotency_keys (key, expires_at, message_id)
  VALUES (?, ?, ?)
`);
const releaseReservationByMessageId = database.prepare("DELETE FROM idempotency_keys WHERE message_id = ?");

export type PrepareOutboundDispatchInput = {
  messageId: string;
  to: string;
  recipientJid?: string;
  idempotencyKey?: string;
};

function persistenceFailure(message: string, cause?: unknown): ApplicationError {
  return new ApplicationError("OUTBOUND_STATE_PERSIST_FAILED", message, { cause });
}

export function prepareOutboundDispatch(input: PrepareOutboundDispatchInput): void {
  const now = Date.now();

  try {
    withTransaction(() => {
      if (input.idempotencyKey) {
        deleteExpiredReservation.run(input.idempotencyKey, now);
        const reservation = reserveIdempotencyKey.run(input.idempotencyKey, now + IDEMPOTENCY_TTL_MS, input.messageId);
        if (Number(reservation.changes) === 0) {
          throw new ApplicationError(
            "DUPLICATE_MESSAGE",
            `Message with idempotency key "${input.idempotencyKey}" was already sent`,
          );
        }
      }

      prepareMessageStatus({
        id: input.messageId,
        to: input.to,
        recipientJid: input.recipientJid,
      });
    });
  } catch (error) {
    if (isApplicationError(error)) {
      throw error;
    }
    throw persistenceFailure("Wago could not persist outbound intent before contacting WhatsApp", error);
  }
}

export function markOutboundDispatchSubmitting(messageId: string): void {
  try {
    const status = markMessageSubmitting(messageId);
    if (status?.dispatchState !== "submitting") {
      throw new Error("Prepared outbound message was not found");
    }
  } catch (error) {
    throw persistenceFailure("Wago could not persist outbound submission state before contacting WhatsApp", error);
  }
}

export function markOutboundDispatchSubmitted(messageId: string, providerMessageId: string | null): void {
  try {
    const status = markMessageSubmitted(messageId, providerMessageId);
    if (status?.dispatchState !== "submitted") {
      throw new Error("Submitting outbound message was not found");
    }
  } catch (error) {
    throw persistenceFailure(
      "Message was submitted to WhatsApp but Wago could not persist transport correlation",
      error,
    );
  }
}

export function abandonOutboundDispatch(messageId: string): void {
  try {
    withTransaction(() => {
      deletePendingMessageStatus(messageId);
      releaseReservationByMessageId.run(messageId);
    });
  } catch (error) {
    logger.error(
      {
        event: "outbound.abandon_persistence_failed",
        errorName: error instanceof Error ? error.name : "UNKNOWN",
        messageId,
      },
      "Wago could not clean up a failed outbound dispatch",
    );
  }
}

export function recoverInterruptedOutboundDispatches(): { abandoned: number; indeterminate: number } {
  const prepared = listPendingMessagesByDispatchState("prepared");
  const submitting = listPendingMessagesByDispatchState("submitting");

  if (prepared.length === 0 && submitting.length === 0) {
    return { abandoned: 0, indeterminate: 0 };
  }

  try {
    withTransaction(() => {
      for (const message of prepared) {
        deletePendingMessageStatus(message.id);
        releaseReservationByMessageId.run(message.id);
      }

      for (const message of submitting) {
        const recovered = markMessageIndeterminate(message.id);
        if (recovered?.dispatchState !== "indeterminate") {
          throw new Error(`Could not recover outbound message ${message.id}`);
        }
      }
    });
  } catch (error) {
    throw persistenceFailure("Wago could not recover interrupted outbound dispatch state", error);
  }

  for (const message of submitting) {
    void recordActivity({
      level: "warning",
      category: "messaging",
      code: "message.outcome_indeterminate",
      title: "Message outcome is indeterminate",
      description:
        "Wago restarted while a WhatsApp submission was in progress. The message will not be retried automatically because WhatsApp may already have accepted it.",
      metadata: { messageId: message.id },
    });
  }

  logger.info({
    event: "outbound.recovery_completed",
    abandonedPrepared: prepared.length,
    indeterminate: submitting.length,
  });

  return {
    abandoned: prepared.length,
    indeterminate: submitting.length,
  };
}
