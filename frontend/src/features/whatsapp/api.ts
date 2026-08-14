import { requestJson, requestText } from "../../shared/api/client.js";

export type WhatsAppStatus = "disconnected" | "connecting" | "qr" | "connected";

export type WhatsAppBinding = {
  state: "unbound" | "bound";
  jid: string | null;
  phone: string | null;
  boundAt: string | null;
};

export type AccountHealthAvailability = "available" | "limited" | "unavailable";

export type AccountHealthUnavailableReason = "not_connected" | "session_invalid";

export type AccountHealthSnapshot = {
  availability: AccountHealthAvailability;
  reachoutTimeLock?: {
    isActive: boolean;
    retryAt?: string;
    enforcementType?: string;
  };
  newChatLimit?: {
    period: string;
    maxChats: number | null;
    chatsRemaining: number | null;
    status?: string;
    startsAt?: string;
  };
  unavailableReason?: AccountHealthUnavailableReason;
  checkedAt?: string;
  lastSuccessAt?: string;
  staleAfter?: string;
};

export type StatusResponse = {
  success: boolean;
  status: WhatsAppStatus;
  message?: string;
  binding: WhatsAppBinding;
  accountHealth?: AccountHealthSnapshot;
};

export type QrResponse = {
  success: boolean;
  qr: string | null;
  status: WhatsAppStatus;
  message?: string;
};

export type PairingResponse = {
  success: boolean;
  message: string;
  status: WhatsAppStatus;
};

export type RebindResponse = PairingResponse;

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
  return requestJson<PairingResponse>("/whatsapp/pair", { method: "POST" });
}

export function rebindWhatsApp(): Promise<RebindResponse> {
  return requestJson<RebindResponse>("/whatsapp/rebind", { method: "POST" });
}
