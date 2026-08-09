const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const API_KEY_SESSION_STORAGE_KEY = "wago.apiKey";

function readSessionApiKey(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(API_KEY_SESSION_STORAGE_KEY)?.trim() ?? "";
}

let apiKey = readSessionApiKey();

export type AppInfoResponse = {
  success: true;
  appId: string;
  apiKeyRequired: boolean;
  apiKeyConfigured: boolean;
  apiKeySource: "env" | "generated" | "unset";
  authenticated: boolean;
  credentialSetupRequired: boolean;
  setupRequired: boolean;
};

export type BootstrapAppResponse =
  | {
      success: true;
      appId: string;
      apiKey: string;
      recovered: boolean;
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

export type WhatsAppBinding =
  | {
      state: "unbound";
      jid: null;
      phone: null;
      boundAt: null;
    }
  | {
      state: "bound";
      jid: string;
      phone: string;
      boundAt: string;
    };

export type AccountHealthSnapshot = {
  reachoutTimeLock?: {
    isActive: boolean;
    retryAt?: string;
    enforcementType?: string;
  };
  newChatCap?: {
    total_quota?: number;
    used_quota?: number;
    cycle_start_timestamp?: string;
    cycle_end_timestamp?: string;
    server_sent_timestamp?: string;
    capping_status?: string;
  };
  lastFetchedAt?: string;
  lastFetchErrorAt?: string;
};

export type StatusResponse = {
  success: true;
  status: WhatsAppStatus;
  binding: WhatsAppBinding;
  accountHealth: AccountHealthSnapshot;
};

export type QrResponse = {
  success: boolean;
  qr: string | null;
  status: WhatsAppStatus;
  message?: string;
};

export type PairingResponse =
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

export type RecipientRecord = {
  jid: string;
  resolvedJid?: string;
  label?: string;
  allowed: boolean;
  optedOut: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipientsResponse = {
  success: true;
  recipients: RecipientRecord[];
};

export type RecipientMutationResponse = {
  success: true;
  recipient: RecipientRecord;
};

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

export type ActivityLevel = "info" | "success" | "warning" | "error";
export type ActivityCategory = "system" | "security" | "connection" | "recipient" | "messaging";

export type ActivityEvent = {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  code: string;
  title: string;
  description: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ActivityResponse = {
  success: true;
  events: ActivityEvent[];
};

export type RebindResponse = PairingResponse;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? ((await response.json()) as T)
    : ({
        success: false,
        error: "NON_JSON_RESPONSE",
        message: await response.text(),
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

export function createApiKeyCandidate(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `wa_${hex}`;
}

export function getStoredApiKey(): string {
  return apiKey;
}

export function setStoredApiKey(value: string): void {
  apiKey = value.trim();

  if (typeof window === "undefined") {
    return;
  }

  if (apiKey) {
    window.sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, apiKey);
    return;
  }

  window.sessionStorage.removeItem(API_KEY_SESSION_STORAGE_KEY);
}

export function getAppInfo(): Promise<AppInfoResponse> {
  return requestJson<AppInfoResponse>("/app/info");
}

export function bootstrapApp(candidate: string): Promise<BootstrapAppResponse> {
  return requestJson<BootstrapAppResponse>("/app/bootstrap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey: candidate }),
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

export function pairWhatsApp(): Promise<PairingResponse> {
  return requestJson<PairingResponse>("/whatsapp/pair", {
    method: "POST",
  });
}

export function listRecipients(): Promise<RecipientsResponse> {
  return requestJson<RecipientsResponse>("/recipients");
}

export function allowRecipient(phone: string, label?: string): Promise<RecipientMutationResponse> {
  return requestJson<RecipientMutationResponse>("/recipients/allow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, ...(label?.trim() ? { label: label.trim() } : {}) }),
  });
}

export function optOutRecipient(phone: string): Promise<RecipientMutationResponse> {
  return requestJson<RecipientMutationResponse>(`/recipients/${encodeURIComponent(phone)}/opt-out`, {
    method: "POST",
  });
}

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

export function listActivity(limit = 100): Promise<ActivityResponse> {
  return requestJson<ActivityResponse>(`/activity?limit=${encodeURIComponent(String(limit))}`);
}

export function rebindWhatsApp(): Promise<RebindResponse> {
  return requestJson<RebindResponse>("/whatsapp/rebind", {
    method: "POST",
  });
}
