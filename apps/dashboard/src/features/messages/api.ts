import { requestBlob, requestJson } from "../../shared/api/client.js";

export type SendMessageResponse = {
  success: true;
  messageId: string;
  status: "pending";
};

export type MessageDeliveryEvidence = "submitted" | "server_accepted" | "delivered" | "read" | "played";
export type MessageMediaKind = "image" | "video" | "audio" | "document";

export type MessageStatusResponse = {
  success: true;
  id: string;
  to: string;
  status: "pending" | "accepted" | "rejected";
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

export type MessageDiagnosticResponse = Omit<MessageStatusResponse, "to"> & {
  dispatchState: "prepared" | "submitting" | "submitted" | "indeterminate";
  webhook: {
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
  } | null;
};

export type SendMediaMessageInput = {
  to: string;
  kind: MessageMediaKind;
  data: Blob | ArrayBuffer;
  mimetype: string;
  caption?: string;
  fileName?: string;
  replyToMessageId?: string;
  idempotencyKey?: string;
};

export function createMessageIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function sendMessage(
  to: string,
  text: string,
  idempotencyKey = createMessageIdempotencyKey(),
): Promise<SendMessageResponse> {
  return requestJson<SendMessageResponse>("/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ to, text }),
  });
}

export function sendReplyMessage(
  to: string,
  text: string,
  replyToMessageId: string,
  idempotencyKey = createMessageIdempotencyKey(),
): Promise<SendMessageResponse> {
  return requestJson<SendMessageResponse>("/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ to, text, replyToMessageId }),
  });
}

export function sendMediaMessage(input: SendMediaMessageInput): Promise<SendMessageResponse> {
  const idempotencyKey = input.idempotencyKey ?? createMessageIdempotencyKey();
  const body = input.data instanceof Blob ? input.data : new Blob([input.data], { type: input.mimetype });
  const headers: Record<string, string> = {
    "Content-Type": input.mimetype,
    "Idempotency-Key": idempotencyKey,
    "X-Wago-To": input.to,
    "X-Wago-Media-Kind": input.kind,
  };

  if (input.caption) headers["X-Wago-Caption"] = input.caption;
  if (input.fileName) headers["X-Wago-Filename"] = input.fileName;
  if (input.replyToMessageId) headers["X-Wago-Reply-To"] = input.replyToMessageId;

  return requestJson<SendMessageResponse>("/messages/send-media", {
    method: "POST",
    headers,
    body,
  });
}

export function downloadInboundMedia(messageId: string): Promise<Blob> {
  return requestBlob(`/messages/incoming/${encodeURIComponent(messageId)}/media`);
}

export function getMessageStatus(messageId: string): Promise<MessageStatusResponse> {
  return requestJson<MessageStatusResponse>(`/messages/${encodeURIComponent(messageId)}/status`);
}

export function getMessageDiagnostics(messageId: string): Promise<MessageDiagnosticResponse> {
  return requestJson<MessageDiagnosticResponse>(`/messages/${encodeURIComponent(messageId)}`);
}
