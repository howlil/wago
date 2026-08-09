import { recordActivity } from "../activity/store.js";
import { type AccountHealthSnapshot, getAccountHealthSnapshot } from "./account-health.js";
import { getWhatsAppBinding, type WhatsAppBinding } from "./binding-store.js";

export type WhatsAppStatus = "connecting" | "qr" | "connected" | "disconnected";

let status: WhatsAppStatus = "disconnected";
let currentQr: string | null = null;

export type WhatsAppStatusSnapshot = {
  status: WhatsAppStatus;
  binding: WhatsAppBinding;
  accountHealth: AccountHealthSnapshot;
};

export function markConnecting(): void {
  if (status !== "connecting") {
    void recordActivity({
      level: "info",
      category: "connection",
      code: "whatsapp.connecting",
      title: "Connecting to WhatsApp",
      description: "The gateway is preparing or restoring the WhatsApp session.",
    });
  }

  status = "connecting";
}

export function markQr(qr: string): void {
  if (status !== "qr") {
    void recordActivity({
      level: "info",
      category: "connection",
      code: "whatsapp.qr_ready",
      title: "Pairing QR ready",
      description: "Open WhatsApp Linked devices and scan the QR code shown in the dashboard.",
    });
  }

  currentQr = qr;
  status = "qr";
}

export function markConnected(): void {
  if (status !== "connected") {
    const binding = getWhatsAppBinding();
    void recordActivity({
      level: "success",
      category: "connection",
      code: "whatsapp.connected",
      title: "WhatsApp connected",
      description: "The linked WhatsApp session is online and ready for gateway operations.",
      metadata: binding.state === "bound" ? { accountJid: binding.jid } : undefined,
    });
  }

  currentQr = null;
  status = "connected";
}

export function markDisconnected(): void {
  if (status !== "disconnected") {
    void recordActivity({
      level: "warning",
      category: "connection",
      code: "whatsapp.disconnected",
      title: "WhatsApp disconnected",
      description:
        "The linked WhatsApp session is currently offline. The gateway may attempt to reconnect automatically.",
    });
  }

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
    binding: getWhatsAppBinding(),
    accountHealth: getAccountHealthSnapshot(),
  };
}

export function getCurrentQrState(): { qr: string | null; status: WhatsAppStatus } {
  return { qr: currentQr, status };
}
