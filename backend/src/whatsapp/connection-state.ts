import { type AccountHealthSnapshot, getAccountHealthSnapshot } from "./account-health.js";

export type WhatsAppStatus = "connecting" | "qr" | "connected" | "disconnected";

let status: WhatsAppStatus = "disconnected";
let currentQr: string | null = null;

export type WhatsAppStatusSnapshot = {
  status: WhatsAppStatus;
  accountHealth: AccountHealthSnapshot;
};

export function markConnecting(): void {
  status = "connecting";
}

export function markQr(qr: string): void {
  currentQr = qr;
  status = "qr";
}

export function markConnected(): void {
  currentQr = null;
  status = "connected";
}

export function markDisconnected(): void {
  currentQr = null;
  status = "disconnected";
}

export function clearQr(): void {
  currentQr = null;
}

export function getConnectionStatus(): WhatsAppStatus {
  return status;
}

export function getWhatsAppStatusSnapshot(): WhatsAppStatusSnapshot {
  return {
    status,
    accountHealth: getAccountHealthSnapshot(),
  };
}

export function getCurrentQrState(): { qr: string | null; status: WhatsAppStatus } {
  return { qr: currentQr, status };
}
