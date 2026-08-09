import { AlertTriangle, CheckCircle2, Server, ShieldCheck, Smartphone, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import type { AccountHealthSnapshot, WhatsAppStatus } from "../../api.js";
import type { HealthState } from "../../features/dashboard/types.js";
import { cardClass } from "../ui/classes.js";

type OverviewCardsProps = {
  health: HealthState;
  status: WhatsAppStatus;
  accountHealth?: AccountHealthSnapshot;
};

type Tone = "ok" | "warning" | "error" | "muted";

const toneClass: Record<Tone, string> = {
  ok: "text-[#176b55]",
  warning: "text-[#916000]",
  error: "text-[#a12d35]",
  muted: "text-[#687970]",
};

const statusLabel: Record<WhatsAppStatus, string> = {
  connecting: "Connecting",
  qr: "Scan QR",
  connected: "Connected",
  disconnected: "Disconnected",
};

function backendSummary(health: HealthState): { value: string; tone: Tone; description: string } {
  if (health === "ok") {
    return { value: "Healthy", tone: "ok", description: "HTTP API is responding normally." };
  }

  if (health === "checking") {
    return { value: "Checking", tone: "muted", description: "Waiting for the backend health check." };
  }

  return { value: "Unavailable", tone: "error", description: "The dashboard cannot reach the backend." };
}

function whatsappSummary(status: WhatsAppStatus): { value: string; tone: Tone; description: string } {
  if (status === "connected") {
    return { value: statusLabel[status], tone: "ok", description: "The bound account is ready for messaging." };
  }

  if (status === "qr" || status === "connecting") {
    return {
      value: statusLabel[status],
      tone: "warning",
      description: "The WhatsApp session is still being prepared.",
    };
  }

  return { value: statusLabel[status], tone: "error", description: "No active WhatsApp connection is available." };
}

function policySummary(accountHealth?: AccountHealthSnapshot): { value: string; tone: Tone; description: string } {
  const reachoutActive = Boolean(accountHealth?.reachoutTimeLock?.isActive);
  const capStatus = accountHealth?.newChatCap?.capping_status;

  if (reachoutActive) {
    return {
      value: "New reach-outs limited",
      tone: "warning",
      description: "WhatsApp is limiting new outbound conversations. Existing recipients are not globally blocked.",
    };
  }

  if (capStatus === "CAPPED") {
    return {
      value: "New chats capped",
      tone: "warning",
      description: "WhatsApp reports that new conversations have reached their current cap.",
    };
  }

  if (capStatus === "FIRST_WARNING" || capStatus === "SECOND_WARNING") {
    return {
      value: "New-chat warning",
      tone: "warning",
      description: "Wago pauses new recipient sends while WhatsApp reports this warning.",
    };
  }

  return { value: "Normal", tone: "ok", description: "No active outbound restriction is currently reported." };
}

function SummaryCard({
  label,
  value,
  description,
  tone,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  tone: Tone;
  icon: ReactNode;
}) {
  return (
    <article className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#73827b]">{label}</span>
          <strong className={`mt-1.5 block text-lg ${toneClass[tone]}`}>{value}</strong>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf5f1] text-[#45685a]">
          {icon}
        </span>
      </div>
      <p className="mb-0 mt-3 text-sm leading-5 text-[#6a7972]">{description}</p>
    </article>
  );
}

export function OverviewCards({ health, status, accountHealth }: OverviewCardsProps) {
  const backend = backendSummary(health);
  const whatsapp = whatsappSummary(status);
  const policy = policySummary(accountHealth);
  const whatsappIcon =
    status === "connected" ? (
      <CheckCircle2 size={18} />
    ) : status === "disconnected" ? (
      <WifiOff size={18} />
    ) : (
      <Smartphone size={18} />
    );

  return (
    <section id="overview" className="grid scroll-mt-28 gap-3 md:grid-cols-3">
      <SummaryCard
        label="Backend"
        value={backend.value}
        description={backend.description}
        tone={backend.tone}
        icon={<Server size={18} />}
      />
      <SummaryCard
        label="WhatsApp"
        value={whatsapp.value}
        description={whatsapp.description}
        tone={whatsapp.tone}
        icon={whatsappIcon}
      />
      <SummaryCard
        label="Outbound policy"
        value={policy.value}
        description={policy.description}
        tone={policy.tone}
        icon={policy.tone === "warning" ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
      />
    </section>
  );
}
