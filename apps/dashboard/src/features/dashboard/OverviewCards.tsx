import type { BackendHealthState } from "../../shared/types/status.js";
import type { AccountHealthSnapshot, AccountHealthUnavailableReason, WhatsAppStatus } from "../whatsapp/api.js";

type OverviewCardsProps = {
  health: BackendHealthState;
  status: WhatsAppStatus;
  accountHealth?: AccountHealthSnapshot;
};

type Metric = {
  label: string;
  value: string;
  detail: string;
  tone: "ok" | "warning" | "error" | "muted";
};

const toneDot: Record<Metric["tone"], string> = {
  ok: "bg-wago-positive",
  warning: "bg-wago-warning",
  error: "bg-wago-danger",
  muted: "bg-wago-tertiary",
};

function backendMetric(health: BackendHealthState): Metric {
  if (health === "ok") return { label: "Gateway", value: "Healthy", detail: "API responding", tone: "ok" };
  if (health === "checking") {
    return { label: "Gateway", value: "Checking", detail: "Health check running", tone: "muted" };
  }
  return { label: "Gateway", value: "Unavailable", detail: "Backend unreachable", tone: "error" };
}

function whatsappMetric(status: WhatsAppStatus): Metric {
  if (status === "connected") return { label: "WhatsApp", value: "Connected", detail: "Session ready", tone: "ok" };
  if (status === "qr") return { label: "WhatsApp", value: "Pairing", detail: "Scan QR to continue", tone: "warning" };
  if (status === "connecting") {
    return { label: "WhatsApp", value: "Connecting", detail: "Restoring session", tone: "warning" };
  }
  return { label: "WhatsApp", value: "Disconnected", detail: "No active session", tone: "error" };
}

function unavailableHealthDetail(reason?: AccountHealthUnavailableReason): string {
  if (reason === "session_invalid") return "Waiting for WhatsApp re-pair";
  if (reason === "fetch_failed") return "Account check unavailable";
  return "Waiting for account health";
}

function messagingMetric(
  health: BackendHealthState,
  status: WhatsAppStatus,
  accountHealth?: AccountHealthSnapshot,
): Metric {
  if (health === "checking") {
    return { label: "Messaging", value: "Waiting", detail: "Gateway check in progress", tone: "muted" };
  }
  if (health !== "ok") {
    return { label: "Messaging", value: "Waiting", detail: "Requires gateway", tone: "muted" };
  }
  if (status !== "connected") {
    return { label: "Messaging", value: "Waiting", detail: "Requires WhatsApp", tone: "muted" };
  }
  if (accountHealth?.availability === "checking") {
    return { label: "Messaging", value: "Checking", detail: "Account health refreshing", tone: "muted" };
  }
  if (accountHealth?.availability !== "available") {
    return {
      label: "Messaging",
      value: accountHealth?.unavailableReason === "fetch_failed" ? "Check unavailable" : "Waiting",
      detail: unavailableHealthDetail(accountHealth?.unavailableReason),
      tone: accountHealth?.unavailableReason === "fetch_failed" ? "warning" : "muted",
    };
  }

  const reachoutActive = Boolean(accountHealth.reachoutTimeLock?.isActive);
  const capStatus = accountHealth.newChatCap?.capping_status;

  if (reachoutActive) {
    return {
      label: "Messaging",
      value: "New chats limited",
      detail: "Known recipients remain eligible",
      tone: "warning",
    };
  }
  if (capStatus === "CAPPED") {
    return { label: "Messaging", value: "New chats capped", detail: "New recipients paused", tone: "warning" };
  }
  if (capStatus === "FIRST_WARNING" || capStatus === "SECOND_WARNING") {
    return { label: "Messaging", value: "Warning", detail: "New recipients paused", tone: "warning" };
  }
  return { label: "Messaging", value: "Normal", detail: "No active restriction", tone: "ok" };
}

function StatusMetric({ metric }: { metric: Metric }) {
  return (
    <section aria-label={`${metric.label} status`} className="min-w-0 bg-white px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[metric.tone]}`} />
        <span className="text-[11px] font-semibold text-wago-muted">{metric.label}</span>
      </div>
      <strong className="mt-1 block text-[15px] font-semibold tracking-[-0.015em] text-wago-ink">{metric.value}</strong>
      <span className="mt-0.5 block text-[10px] leading-4 text-wago-tertiary">{metric.detail}</span>
    </section>
  );
}

export function OverviewCards({ health, status, accountHealth }: OverviewCardsProps) {
  return (
    <section className="grid divide-y divide-wago-line overflow-hidden rounded-lg border border-wago-line bg-white md:grid-cols-3 md:divide-x md:divide-y-0">
      <StatusMetric metric={backendMetric(health)} />
      <StatusMetric metric={whatsappMetric(status)} />
      <StatusMetric metric={messagingMetric(health, status, accountHealth)} />
    </section>
  );
}
