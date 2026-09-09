import type {
  AccountHealthAvailability,
  AccountHealthSnapshot,
  AccountHealthUnavailableReason,
  NewChatCapacityStatus,
  PairingResponse,
  QrResponse,
  WhatsAppStatusResponse as StatusResponse,
  WhatsAppBinding,
  WhatsAppStatus,
} from "@wago/contracts";
import { requestJson, requestText } from "../../shared/api/client.js";

export type {
  AccountHealthAvailability,
  AccountHealthSnapshot,
  AccountHealthUnavailableReason,
  NewChatCapacityStatus,
  PairingResponse,
  QrResponse,
  StatusResponse,
  WhatsAppBinding,
  WhatsAppStatus,
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
