const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type HealthResponse = {
  status: string;
};

export type WhatsAppStatus = "connecting" | "qr" | "connected" | "disconnected";

export type StatusResponse = {
  success: true;
  status: WhatsAppStatus;
};

export type QrResponse = {
  success: boolean;
  qr: string | null;
  status: WhatsAppStatus;
  message?: string;
};

export type SendMessageResponse =
  | {
      success: true;
      messageId: string | null;
      status: "accepted";
    }
  | {
      success: false;
      error: string;
      message: string;
    };

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const data = (await response.json()) as T;

  if (!response.ok) {
    throw data;
  }

  return data;
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health");
}

export function getWhatsAppStatus(): Promise<StatusResponse> {
  return requestJson<StatusResponse>("/whatsapp/status");
}

export function getCurrentQr(): Promise<QrResponse> {
  return requestJson<QrResponse>("/whatsapp/qr");
}

export function getQrImageUrl(): string {
  return `${API_BASE_URL}/whatsapp/qr/image`;
}

export function sendMessage(to: string, text: string): Promise<SendMessageResponse> {
  return requestJson<SendMessageResponse>("/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ to, text })
  });
}
