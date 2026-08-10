import { MessageCircleMore, RadioTower, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import type { AccountHealthSnapshot, WhatsAppStatus } from "../../api.js";
import type { HealthState } from "../../features/dashboard/types.js";

type OverviewCardsProps = {
  health: HealthState;
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

function backendMetric(health: HealthState): Metric {
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
    return { label: "WhatsApp", value: "Pairing", detail: "Scan QR to continue", tone: "warning", icon: MessageCircleMore };
  }
  if (status === "connecting") {
    return { label: "WhatsApp", value: "Connecting", detail: "Restoring session", tone: "warning", icon: MessageCircleMore };
  }
  return {
    label: "WhatsApp",
    value: "Disconnected",
    detail: "No active session",
    tone: "error",
    icon: MessageCircleMore,
  };
}

function policyMetric(accountHealth?: AccountHealthSnapshot): Metric {
  const reachoutActive = Boolean(accountHealth?.reachoutTimeLock?.isActive);
  const capStatus = accountHealth?.newChatCap?.capping_status;

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
    return { label: "Outbound", value: "New chats capped", detail: "New recipients paused", tone: "warning", icon: ShieldCheck };
  }
  if (capStatus === "FIRST_WARNING" || capStatus === "SECOND_WARNING") {
    return { label: "Outbound", value: "Warning", detail: "New recipients paused", tone: "warning", icon: ShieldCheck };
  }
  return { label: "Outbound", value: "Normal", detail: "No active restriction", tone: "ok", icon: ShieldCheck };
}

function StatusMetric({ metric }: { metric: Metric }) {
  const Icon = metric.icon;

  return (
    <div className="group relative min-w-0 overflow-hidden bg-white px-4 py-4 transition hover:bg-[#fcfdfc] sm:px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d7e7df] to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-center gap-3.5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneIcon[metric.tone]}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-wago-muted">{metric.label}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${toneDot[metric.tone]}`} />
          </div>
          <strong className="mt-1 block truncate text-[15px] font-bold tracking-[-0.02em] text-wago-ink">{metric.value}</strong>
          <span className="mt-0.5 block truncate text-[10px] font-medium text-[#818b86]">{metric.detail}</span>
        </div>
      </div>
    </div>
  );
}

export function OverviewCards({ health, status, accountHealth }: OverviewCardsProps) {
  return (
    <section className="grid overflow-hidden rounded-2xl border border-[#dce7e1] bg-white shadow-[0_12px_34px_rgba(31,70,53,0.055)] md:grid-cols-3 md:divide-x md:divide-[#e4ebe7]">
      <StatusMetric metric={backendMetric(health)} />
      <StatusMetric metric={whatsappMetric(status)} />
      <StatusMetric metric={policyMetric(accountHealth)} />
    </section>
  );
}
