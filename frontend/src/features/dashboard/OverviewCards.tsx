import { MessageCircleMore, RadioTower, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import type { AccountHealthSnapshot, AccountHealthUnavailableReason, WhatsAppStatus } from "../../api.js";
import type { BackendHealthState } from "../../shared/types/status.js";

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
  icon: ComponentType<{ size?: number; className?: string }>;
};

const toneDot: Record<Metric["tone"], string> = {
  ok: "bg-[#2f9b70]",
  warning: "bg-[#c08a2e]",
  error: "bg-[#bd4a52]",
  muted: "bg-[#9aa49f]",
};

const toneIcon: Record<Metric["tone"], string> = {
  ok: "border-[#cfe8dc] bg-[#edf8f3] text-[#277a59]",
  warning: "border-[#eadcb7] bg-[#fbf5e7] text-[#956b1d]",
  error: "border-[#efcfd2] bg-[#fff2f3] text-[#a44249]",
  muted: "border-[#dde3e0] bg-[#f5f7f6] text-[#77827d]",
};

function backendMetric(health: BackendHealthState): Metric {
  if (health === "ok") {
    return { label: "Gateway", value: "Healthy", detail: "API responding", tone: "ok", icon: RadioTower };
  }
  if (health === "checking") {
    return { label: "Gateway", value: "Checking", detail: "Health check running", tone: "muted", icon: RadioTower };
  }
  return { label: "Gateway", value: "Unavailable", detail: "Backend unreachable", tone: "error", icon: RadioTower };
}

function whatsappMetric(status: WhatsAppStatus): Metric {
  if (status === "connected") {
    return { label: "WhatsApp", value: "Connected", detail: "Session ready", tone: "ok", icon: MessageCircleMore };
  }
  if (status === "qr") {
    return {
      label: "WhatsApp",
      value: "Pairing",
      detail: "Scan QR to continue",
      tone: "warning",
      icon: MessageCircleMore,
    };
  }
  if (status === "connecting") {
    return {
      label: "WhatsApp",
      value: "Connecting",
      detail: "Restoring session",
      tone: "warning",
      icon: MessageCircleMore,
    };
  }
  return {
    label: "WhatsApp",
    value: "Disconnected",
    detail: "No active session",
    tone: "error",
    icon: MessageCircleMore,
  };
}

function unavailableHealthDetail(reason?: AccountHealthUnavailableReason): string {
  if (reason === "session_invalid") {
    return "Pair WhatsApp again";
  }
  if (reason === "fetch_failed") {
    return "Health check failed";
  }
  return "Connect WhatsApp to check";
}

function policyMetric(
  health: BackendHealthState,
  status: WhatsAppStatus,
  accountHealth?: AccountHealthSnapshot,
): Metric {
  if (health === "checking") {
    return {
      label: "Outbound",
      value: "Checking",
      detail: "Gateway health is being checked",
      tone: "muted",
      icon: ShieldCheck,
    };
  }
  if (health !== "ok") {
    return { label: "Outbound", value: "Unavailable", detail: "Backend unreachable", tone: "error", icon: ShieldCheck };
  }
  if (status !== "connected") {
    return {
      label: "Outbound",
      value: "Unavailable",
      detail: "WhatsApp is not connected",
      tone: "muted",
      icon: ShieldCheck,
    };
  }
  if (accountHealth?.availability === "checking") {
    return {
      label: "Outbound",
      value: "Checking",
      detail: "Account health is refreshing",
      tone: "muted",
      icon: ShieldCheck,
    };
  }
  if (accountHealth?.availability !== "available") {
    return {
      label: "Outbound",
      value: "Unavailable",
      detail: unavailableHealthDetail(accountHealth?.unavailableReason),
      tone: accountHealth?.unavailableReason === "fetch_failed" ? "warning" : "muted",
      icon: ShieldCheck,
    };
  }

  const reachoutActive = Boolean(accountHealth.reachoutTimeLock?.isActive);
  const capStatus = accountHealth.newChatCap?.capping_status;

  if (reachoutActive) {
    return {
      label: "Outbound",
      value: "New chats limited",
      detail: "Known recipients remain eligible",
      tone: "warning",
      icon: ShieldCheck,
    };
  }
  if (capStatus === "CAPPED") {
    return {
      label: "Outbound",
      value: "New chats capped",
      detail: "New recipients paused",
      tone: "warning",
      icon: ShieldCheck,
    };
  }
  if (capStatus === "FIRST_WARNING" || capStatus === "SECOND_WARNING") {
    return { label: "Outbound", value: "Warning", detail: "New recipients paused", tone: "warning", icon: ShieldCheck };
  }
  return { label: "Outbound", value: "Normal", detail: "No active restriction", tone: "ok", icon: ShieldCheck };
}

function StatusMetric({ metric }: { metric: Metric }) {
  const Icon = metric.icon;

  return (
    <section aria-label={`${metric.label} status`} className="min-w-0 bg-white px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${toneIcon[metric.tone]}`}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-wago-muted">{metric.label}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${toneDot[metric.tone]}`} />
          </div>
          <strong className="mt-1 block truncate text-[15px] font-semibold tracking-[-0.015em] text-wago-ink">
            {metric.value}
          </strong>
          <span className="mt-0.5 block truncate text-[10px] font-medium text-[#818b86]">{metric.detail}</span>
        </div>
      </div>
    </section>
  );
}

export function OverviewCards({ health, status, accountHealth }: OverviewCardsProps) {
  return (
    <section className="grid overflow-hidden rounded-lg border border-wago-line bg-white md:grid-cols-3 md:divide-x md:divide-wago-line">
      <StatusMetric metric={backendMetric(health)} />
      <StatusMetric metric={whatsappMetric(status)} />
      <StatusMetric metric={policyMetric(health, status, accountHealth)} />
    </section>
  );
}
