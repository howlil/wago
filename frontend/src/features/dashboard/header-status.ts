import type { BackendHealthState } from "../../shared/types/status.js";
import type { GatewayReadinessSnapshot } from "../gateway/api.js";
import type { WhatsAppStatus } from "../whatsapp/api.js";

export type GatewayHeaderStatus = {
  label: string;
  tone: "positive" | "warning" | "danger" | "neutral";
};

export function getGatewayHeaderStatus(
  health: BackendHealthState,
  readiness: GatewayReadinessSnapshot | null,
  whatsappStatus: WhatsAppStatus,
): GatewayHeaderStatus {
  if (health === "error") {
    return { label: "Backend offline", tone: "danger" };
  }

  if (health === "checking") {
    return { label: "Checking", tone: "neutral" };
  }

  if (readiness?.status === "not_ready") {
    return { label: "Not ready", tone: "danger" };
  }

  if (readiness?.status === "degraded") {
    return { label: "Degraded", tone: "warning" };
  }

  if (readiness?.status === "ok") {
    return { label: "Ready", tone: "positive" };
  }

  if (whatsappStatus === "connected") {
    return { label: "Connected", tone: "positive" };
  }

  if (whatsappStatus === "qr") {
    return { label: "Waiting for QR", tone: "warning" };
  }

  if (whatsappStatus === "connecting") {
    return { label: "Connecting", tone: "warning" };
  }

  return { label: "Disconnected", tone: "neutral" };
}
