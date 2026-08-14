import { requestJson } from "../../shared/api/client.js";

export type SendMessageResponse =
  | {
      success: true;
      messageId: string | null;
      status: "pending";
    }
  | {
      success: false;
      error: string;
      message: string;
    };

export type MessageStatusResponse =
  | {
      success: true;
      id: string;
      to: string;
      status: "pending" | "accepted" | "rejected";
      error?: string;
      message?: string;
      updatedAt: string;
    }
  | {
      success: false;
      error: string;
      message: string;
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
