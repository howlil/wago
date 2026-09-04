import { requestJson, requestText } from "../../shared/api/client.js";

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
export type NewChatCapacityStatus = "unknown" | "healthy" | "warning" | "capped";

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
  newChatCapacity: {
    status: NewChatCapacityStatus;
    used?: number;
    total?: number;
    cycleStartAt?: string;
    cycleEndAt?: string;
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
  success: true;
  qr: string | null;
  status: WhatsAppStatus;
  message?: string;
};

export type PairingResponse = {
  success: true;
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
