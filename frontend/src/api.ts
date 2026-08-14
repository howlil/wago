import { requestJson, requestText } from "./shared/api/client.js";

const LEGACY_API_KEY_SESSION_STORAGE_KEY = "wago.apiKey";

if (typeof window !== "undefined") {
  window.sessionStorage.removeItem(LEGACY_API_KEY_SESSION_STORAGE_KEY);
}

export type AppInfoResponse = {
  success: true;
  appId: string;
  apiKeyRequired: boolean;
  apiKeyConfigured: boolean;
  apiKeySource: "env" | "generated" | "unset";
  authenticated: boolean;
  credentialSetupRequired: boolean;
  setupRequired: boolean;
  setupTokenRequired?: boolean;
  webBootstrapEnabled?: boolean;
};

export type BootstrapAppResponse =
  | {
      success: true;
      appId: string;
      apiKey: string;
      recovered: boolean;
      sessionExpiresAt: string;
      message: string;
    }
  | {
      success: false;
      error: string;
      message: string;
    };

export type BrowserSessionResponse =
  | {
      success: true;
      authenticated: boolean;
      expiresAt?: string;
      revokedBrowserSessions?: number;
      message: string;
    }
  | {
      success: false;
      error: string;
      message: string;
    };

export type ApiKeyRotationResponse =
  | {
      success: true;
      apiKey: string;
      generatedAt: string;
      revokedBrowserSessions?: number;
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

export type AccountHealthAvailability = "unavailable" | "checking" | "available";
export type AccountHealthUnavailableReason = "not_connected" | "session_invalid" | "fetch_failed";

export type AccountHealthSnapshot = {
  availability: AccountHealthAvailability;
  unavailableReason?: AccountHealthUnavailableReason;
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
export type AuditSource = "wago" | "baileys";

export type ActivityEvent = {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  source: AuditSource;
  code: string;
  title: string;
  description: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ActivityResponse = {
  success: true;
  events: ActivityEvent[];
  nextCursor?: string;
};

export type ActivityQuery = {
  limit?: number;
  before?: string;
  source?: AuditSource;
  category?: ActivityCategory;
  level?: ActivityLevel;
  q?: string;
};

export type WebhookSettingsResponse = {
  success: true;
  enabled: boolean;
  url: string | null;
  secretConfigured: boolean;
  rotationPending: boolean;
  updatedAt: string | null;
  generatedSecret?: string;
};

export type RebindResponse = PairingResponse;

export function createApiKeyCandidate(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `wa_${hex}`;
}

export function getAppInfo(): Promise<AppInfoResponse> {
  return requestJson<AppInfoResponse>("/app/info");
}

export function bootstrapApp(candidate: string, setupToken?: string): Promise<BootstrapAppResponse> {
  return requestJson<BootstrapAppResponse>("/app/bootstrap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(setupToken ? { "X-Wago-Setup-Token": setupToken } : {}),
    },
    body: JSON.stringify({ apiKey: candidate }),
  });
}

export function createBrowserSession(apiKey: string): Promise<BrowserSessionResponse> {
  return requestJson<BrowserSessionResponse>("/app/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey }),
  });
}

export function rotateApiKey(): Promise<ApiKeyRotationResponse> {
  return requestJson<ApiKeyRotationResponse>("/app/api-key/rotate", {
    method: "POST",
  });
}

export function logoutBrowserSession(): Promise<BrowserSessionResponse> {
  return requestJson<BrowserSessionResponse>("/app/session/logout", {
    method: "POST",
  });
}

export function logoutAllBrowserSessions(): Promise<BrowserSessionResponse> {
  return requestJson<BrowserSessionResponse>("/app/session/logout-all", {
    method: "POST",
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

export function listActivity(query: ActivityQuery = {}): Promise<ActivityResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? 100));

  if (query.before) {
    params.set("before", query.before);
  }
  if (query.source) {
    params.set("source", query.source);
  }
  if (query.category) {
    params.set("category", query.category);
  }
  if (query.level) {
    params.set("level", query.level);
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim().slice(0, 100));
  }

  return requestJson<ActivityResponse>(`/activity?${params.toString()}`);
}

export function getWebhookSettings(): Promise<WebhookSettingsResponse> {
  return requestJson<WebhookSettingsResponse>("/webhooks/settings");
}

export function updateWebhookSettings(input: {
  enabled: boolean;
  url: string | null;
}): Promise<WebhookSettingsResponse> {
  return requestJson<WebhookSettingsResponse>("/webhooks/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function rotateWebhookSecret(): Promise<WebhookSettingsResponse> {
  return requestJson<WebhookSettingsResponse>("/webhooks/settings/rotate-secret", {
    method: "POST",
  });
}

export function completeWebhookSecretRotation(): Promise<WebhookSettingsResponse> {
  return requestJson<WebhookSettingsResponse>("/webhooks/settings/complete-rotation", {
    method: "POST",
  });
}

export function rebindWhatsApp(): Promise<RebindResponse> {
  return requestJson<RebindResponse>("/whatsapp/rebind", {
    method: "POST",
  });
}
