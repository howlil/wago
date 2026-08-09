const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const API_KEY_STORAGE = "wa_gateway_api_key";
let apiKey = sessionStorage.getItem(API_KEY_STORAGE)?.trim() || "";

export type AppInfoResponse = {
  success: true;
  appId: string;
  apiKeyRequired: boolean;
  apiKeyConfigured: boolean;
  apiKeySource: "env" | "generated" | "unset";
  authenticated: boolean;
  setupRequired: boolean;
};

export type BootstrapAppResponse =
  | {
      success: true;
      appId: string;
      apiKey: string;
      message: string;
    }
  | {
      success: false;
      error: string;
      message: string;
    };

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

export type RebindResponse =
  | {
      success: true;
      message: string;
      status: WhatsAppStatus;
    }
  | {
      success: false;
      error: string;
      message: string;
    };

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers
  });
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? ((await response.json()) as T)
    : ({
        success: false,
        error: "NON_JSON_RESPONSE",
        message: await response.text()
      } as T);

  if (!response.ok) {
    throw data;
  }

  return data;
}

async function requestText(path: string): Promise<string> {
  const headers = new Headers();

  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.text();
}

export function getStoredApiKey(): string {
  return apiKey;
}

export function setStoredApiKey(value: string): void {
  apiKey = value.trim();

  if (apiKey) {
    sessionStorage.setItem(API_KEY_STORAGE, apiKey);
  } else {
    sessionStorage.removeItem(API_KEY_STORAGE);
  }
}

export function getAppInfo(): Promise<AppInfoResponse> {
  return requestJson<AppInfoResponse>("/app/info");
}

export function bootstrapApp(): Promise<BootstrapAppResponse> {
  return requestJson<BootstrapAppResponse>("/app/bootstrap", {
    method: "POST"
  });
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

export function getQrImageSvg(): Promise<string> {
  return requestText("/whatsapp/qr/image");
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

export function getMessageStatus(messageId: string): Promise<MessageStatusResponse> {
  return requestJson<MessageStatusResponse>(`/messages/${encodeURIComponent(messageId)}/status`);
}

export function rebindWhatsApp(): Promise<RebindResponse> {
  return requestJson<RebindResponse>("/whatsapp/rebind", {
    method: "POST"
  });
}
