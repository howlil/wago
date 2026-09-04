import { requestJson } from "../../shared/api/client.js";

export type SendMessageResponse = {
  success: true;
  messageId: string;
  status: "pending";
};

export type MessageDeliveryEvidence = "submitted" | "server_accepted" | "delivered" | "read" | "played";

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

export function getMessageStatus(messageId: string): Promise<MessageStatusResponse> {
  return requestJson<MessageStatusResponse>(`/messages/${encodeURIComponent(messageId)}/status`);
}

export function getMessageDiagnostics(messageId: string): Promise<MessageDiagnosticResponse> {
  return requestJson<MessageDiagnosticResponse>(`/messages/${encodeURIComponent(messageId)}`);
}
