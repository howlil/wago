import { randomUUID } from "node:crypto";

export type SendMessageCommand = {
  to: string;
  text: string;
  idempotencyKey?: string;
};

export type MessageSendOptions = {
  idempotencyKey?: string;
  messageId: string;
};

export type MessageSendResult = {
  messageId: string;
  status: "pending";
};

export type MessageDeliveryStatus = "pending" | "accepted" | "rejected";
export type MessageDispatchState = "prepared" | "submitting" | "submitted" | "indeterminate";
export type MessageDeliveryEvidence = "submitted" | "server_accepted" | "delivered" | "read" | "played";

export type MessageStatus = {
  id: string;
  to: string;
  status: MessageDeliveryStatus;
  deliveryEvidence?: MessageDeliveryEvidence;
  error?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  serverAcceptedAt?: string;
  deliveredAt?: string;
  readAt?: string;
  playedAt?: string;
};

type MessageStatusRecord = MessageStatus & {
  dispatchState?: MessageDispatchState;
};

export type MessageWebhookDiagnostic = {
  id: string;
  event: string;
  status: string;
  attemptCount: number;
  redeliveryCount: number;
  lastStatusCode: number | null;
  lastErrorCode: string | null;
  createdAt: string;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
};

export type MessageDiagnostic = Omit<MessageStatus, "to"> & {
  dispatchState: MessageDispatchState;
  webhook: MessageWebhookDiagnostic | null;
};

export type MessageService = {
  send: (command: SendMessageCommand) => Promise<MessageSendResult>;
  findStatus: (messageId: string) => MessageStatus | null;
  findDiagnostic: (messageId: string) => MessageDiagnostic | null;
};

type MessageServiceDependencies = {
  sendText: (to: string, text: string, options: MessageSendOptions) => Promise<MessageSendResult>;
  getStatus: (messageId: string) => MessageStatusRecord | null | undefined;
  getWebhookDelivery?: (messageId: string) => MessageWebhookDiagnostic | null;
};

type MessageServiceOptions = {
  createMessageId?: () => string;
};

function sanitizeMessageStatus(status: MessageStatusRecord): MessageStatus {
  return {
    id: status.id,
    to: status.to,
    status: status.status,
    createdAt: status.createdAt,
    updatedAt: status.updatedAt,
    ...(status.deliveryEvidence !== undefined ? { deliveryEvidence: status.deliveryEvidence } : {}),
    ...(status.error !== undefined ? { error: status.error } : {}),
    ...(status.message !== undefined ? { message: status.message } : {}),
    ...(status.acceptedAt !== undefined ? { acceptedAt: status.acceptedAt } : {}),
    ...(status.rejectedAt !== undefined ? { rejectedAt: status.rejectedAt } : {}),
    ...(status.serverAcceptedAt !== undefined ? { serverAcceptedAt: status.serverAcceptedAt } : {}),
    ...(status.deliveredAt !== undefined ? { deliveredAt: status.deliveredAt } : {}),
    ...(status.readAt !== undefined ? { readAt: status.readAt } : {}),
    ...(status.playedAt !== undefined ? { playedAt: status.playedAt } : {}),
  };
}

export function createMessageService(
  deps: MessageServiceDependencies,
  options: MessageServiceOptions = {},
): MessageService {
  const createMessageId = options.createMessageId ?? randomUUID;

  return {
    send(command: SendMessageCommand): Promise<MessageSendResult> {
      return deps.sendText(command.to, command.text, {
        idempotencyKey: command.idempotencyKey,
        messageId: createMessageId(),
      });
    },
    findStatus(messageId: string): MessageStatus | null {
      const status = deps.getStatus(messageId);
      return status ? sanitizeMessageStatus(status) : null;
    },
    findDiagnostic(messageId: string): MessageDiagnostic | null {
      const rawStatus = deps.getStatus(messageId);
      if (!rawStatus) {
        return null;
      }
      const { to: _to, ...status } = sanitizeMessageStatus(rawStatus);

      return {
        ...status,
        dispatchState: rawStatus.dispatchState ?? "submitted",
        webhook: deps.getWebhookDelivery?.(messageId) ?? null,
      };
    },
  };
}
