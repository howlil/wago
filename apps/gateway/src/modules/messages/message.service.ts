import { randomUUID } from "node:crypto";

export type SendMessageCommand = {
  to: string;
  text: string;
  idempotencyKey?: string;
  replyToMessageId?: string;
};

export type MessageSendOptions = {
  idempotencyKey?: string;
  messageId: string;
  replyToMessageId?: string;
};

export type MessageMediaKind = "image" | "video" | "audio" | "document";

export type SendMediaCommand = {
  to: string;
  kind: MessageMediaKind;
  data: Buffer;
  mimetype: string;
  caption?: string;
  fileName?: string;
  idempotencyKey?: string;
  replyToMessageId?: string;
};

export type MessageMediaInput = Pick<SendMediaCommand, "kind" | "data" | "mimetype" | "caption" | "fileName">;

export type MessageSendResult = {
  messageId: string;
  status: "pending";
};

export type DownloadedInboundMedia = {
  data: Buffer;
  media: {
    kind: MessageMediaKind;
    mimetype?: string;
    fileName?: string;
    fileLength?: number;
    caption?: string;
    seconds?: number;
    width?: number;
    height?: number;
  };
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
  sendMedia: (command: SendMediaCommand) => Promise<MessageSendResult>;
  downloadInboundMedia: (messageId: string) => Promise<DownloadedInboundMedia>;
  findStatus: (messageId: string) => MessageStatus | null;
  findDiagnostic: (messageId: string) => MessageDiagnostic | null;
};

type MessageServiceDependencies = {
  sendText: (to: string, text: string, options: MessageSendOptions) => Promise<MessageSendResult>;
  sendMedia: (to: string, media: MessageMediaInput, options: MessageSendOptions) => Promise<MessageSendResult>;
  downloadInboundMedia: (messageId: string) => Promise<DownloadedInboundMedia>;
  getStatus: (messageId: string) => MessageStatusRecord | null | undefined;
  getWebhookDelivery?: (messageId: string) => MessageWebhookDiagnostic | null;
};

type MessageServiceOptions = {
  createMessageId?: () => string;
};

function optionalStatusFields(status: MessageStatusRecord) {
  return {
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

function sanitizeMessageStatus(status: MessageStatusRecord): MessageStatus {
  return {
    id: status.id,
    to: status.to,
    status: status.status,
    createdAt: status.createdAt,
    updatedAt: status.updatedAt,
    ...optionalStatusFields(status),
  };
}

function sendOptions(
  command: { idempotencyKey?: string; replyToMessageId?: string },
  messageId: string,
): MessageSendOptions {
  return {
    ...(command.idempotencyKey !== undefined ? { idempotencyKey: command.idempotencyKey } : {}),
    messageId,
    ...(command.replyToMessageId !== undefined ? { replyToMessageId: command.replyToMessageId } : {}),
  };
}

export function createMessageService(
  deps: MessageServiceDependencies,
  options: MessageServiceOptions = {},
): MessageService {
  const createMessageId = options.createMessageId ?? randomUUID;

  return {
    send(command: SendMessageCommand): Promise<MessageSendResult> {
      return deps.sendText(command.to, command.text, sendOptions(command, createMessageId()));
    },
    sendMedia(command: SendMediaCommand): Promise<MessageSendResult> {
      return deps.sendMedia(
        command.to,
        {
          kind: command.kind,
          data: command.data,
          mimetype: command.mimetype,
          ...(command.caption !== undefined ? { caption: command.caption } : {}),
          ...(command.fileName !== undefined ? { fileName: command.fileName } : {}),
        },
        sendOptions(command, createMessageId()),
      );
    },
    downloadInboundMedia(messageId: string): Promise<DownloadedInboundMedia> {
      return deps.downloadInboundMedia(messageId);
    },
    findStatus(messageId: string): MessageStatus | null {
      const status = deps.getStatus(messageId);
      return status ? sanitizeMessageStatus(status) : null;
    },
    findDiagnostic(messageId: string): MessageDiagnostic | null {
      const status = deps.getStatus(messageId);
      if (!status) return null;

      return {
        id: status.id,
        status: status.status,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
        ...optionalStatusFields(status),
        dispatchState: status.dispatchState ?? "submitted",
        webhook: deps.getWebhookDelivery?.(messageId) ?? null,
      };
    },
  };
}
