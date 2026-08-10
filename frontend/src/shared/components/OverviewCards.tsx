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
};

const toneDot: Record<Metric["tone"], string> = {
  ok: "bg-[#2f8b67]",
  warning: "bg-[#c08a2e]",
  error: "bg-[#bd4a52]",
  muted: "bg-[#9aa49f]",
};

function backendMetric(health: HealthState): Metric {
  if (health === "ok") {
    return { label: "Gateway", value: "Healthy", detail: "API responding", tone: "ok" };
  }
  if (health === "checking") {
    return { label: "Gateway", value: "Checking", detail: "Health check running", tone: "muted" };
  }
  return { label: "Gateway", value: "Unavailable", detail: "Backend unreachable", tone: "error" };
}

function whatsappMetric(status: WhatsAppStatus): Metric {
  if (status === "connected") {
    return { label: "WhatsApp", value: "Connected", detail: "Session ready", tone: "ok" };
  }
  if (status === "qr") {
    return { label: "WhatsApp", value: "Pairing", detail: "Scan QR to continue", tone: "warning" };
  }
  if (status === "connecting") {
    return { label: "WhatsApp", value: "Connecting", detail: "Restoring session", tone: "warning" };
  }
  return { label: "WhatsApp", value: "Disconnected", detail: "No active session", tone: "error" };
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
    };
  }
  if (capStatus === "CAPPED") {
    return { label: "Outbound", value: "New chats capped", detail: "New recipients paused", tone: "warning" };
  }
  if (capStatus === "FIRST_WARNING" || capStatus === "SECOND_WARNING") {
    return { label: "Outbound", value: "Warning", detail: "New recipients paused", tone: "warning" };
  }
  return { label: "Outbound", value: "Normal", detail: "No active restriction", tone: "ok" };
}

function StatusMetric({ metric }: { metric: Metric }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot[metric.tone]}`} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-wago-muted">{metric.label}</span>
          <strong className="text-[13px] font-semibold text-wago-ink">{metric.value}</strong>
        </div>
        <span className="mt-0.5 block truncate text-[10px] text-[#818b86]">{metric.detail}</span>
      </div>
    </div>
  );
}

export function OverviewCards({ health, status, accountHealth }: OverviewCardsProps) {
  return (
    <section className="grid overflow-hidden rounded-lg border border-wago-line bg-white md:grid-cols-3 md:divide-x md:divide-wago-line">
      <StatusMetric metric={backendMetric(health)} />
      <StatusMetric metric={whatsappMetric(status)} />
      <StatusMetric metric={policyMetric(accountHealth)} />
    </section>
  );
}
