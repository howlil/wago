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

export type MessageStatus = {
  id: string;
  to: string;
  status: MessageDeliveryStatus;
  error?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
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
  webhook: MessageWebhookDiagnostic | null;
};

export type MessageService = {
  send: (command: SendMessageCommand) => Promise<MessageSendResult>;
  findStatus: (messageId: string) => MessageStatus | null | undefined;
  findDiagnostic: (messageId: string) => MessageDiagnostic | null;
};

type MessageServiceDependencies = {
  sendText: (to: string, text: string, options: MessageSendOptions) => Promise<MessageSendResult>;
  getStatus: (messageId: string) => MessageStatus | null | undefined;
  getWebhookDelivery?: (messageId: string) => MessageWebhookDiagnostic | null;
};

type MessageServiceOptions = {
  createMessageId?: () => string;
};

export function createMessageService(deps: MessageServiceDependencies, options: MessageServiceOptions = {}): MessageService {
  const createMessageId = options.createMessageId ?? randomUUID;

  return {
    send(command: SendMessageCommand): Promise<MessageSendResult> {
      return deps.sendText(command.to, command.text, {
        idempotencyKey: command.idempotencyKey,
        messageId: createMessageId(),
      });
    },
    findStatus(messageId: string): MessageStatus | null | undefined {
      return deps.getStatus(messageId);
    },
    findDiagnostic(messageId: string): MessageDiagnostic | null {
      const status = deps.getStatus(messageId);
      if (!status) {
        return null;
      }

      return {
        id: status.id,
        status: status.status,
        error: status.error,
        message: status.message,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
        acceptedAt: status.acceptedAt,
        rejectedAt: status.rejectedAt,
        webhook: deps.getWebhookDelivery?.(messageId) ?? null,
      };
    },
  };
}
