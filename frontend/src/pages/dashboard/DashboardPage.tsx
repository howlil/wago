import { OperationalReadinessBanner } from "../../features/dashboard/OperationalReadinessBanner.js";
import { OverviewCards } from "../../features/dashboard/OverviewCards.js";
import { useDashboardController } from "../../features/dashboard/useDashboardController.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";
import type { BackendHealthState } from "../../shared/types/status.js";
import { DashboardDiagnostics } from "./DashboardDiagnostics.js";
import { DashboardDialogs } from "./DashboardDialogs.js";
import { DashboardMainColumn } from "./DashboardMainColumn.js";

type DashboardStatus = ReturnType<typeof useDashboardController>["status"];

const statusLabel: Record<DashboardStatus, string> = {
  connecting: "Connecting",
  qr: "Waiting for QR",
  connected: "Connected",
  disconnected: "Disconnected",
};

function getHeaderStatus(health: BackendHealthState, status: DashboardStatus) {
  if (health === "error") return { label: "Backend offline", tone: "danger" as const };
  if (health === "checking") return { label: "Checking", tone: "neutral" as const };
  return {
    label: statusLabel[status],
    tone:
      status === "connected"
        ? ("positive" as const)
        : status === "qr" || status === "connecting"
          ? ("warning" as const)
          : ("neutral" as const),
  };
}

export function DashboardPage() {
  const dashboard = useDashboardController();
  const headerStatus = getHeaderStatus(dashboard.health, dashboard.status);

  return (
    <AppShell
      title="Control"
      description="Observe gateway health, operate the WhatsApp connection and troubleshoot delivery."
      activePath="/"
      statusLabel={headerStatus.label}
      statusTone={headerStatus.tone}
      isRefreshing={dashboard.isRefreshing}
      onRefresh={() => void dashboard.refresh({ showLoading: true })}
      refreshLabel="Refresh status"
    >
      <section aria-labelledby="gateway-status-title">
        <div className="mb-2">
          <h2 id="gateway-status-title" className="m-0 text-[13px] font-semibold tracking-[-0.01em] text-wago-ink">
            Gateway status
          </h2>
          <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">
            Runtime readiness, WhatsApp connection and account availability.
          </p>
        </div>
        <OverviewCards health={dashboard.health} status={dashboard.status} accountHealth={dashboard.accountHealth} />
        <OperationalReadinessBanner readiness={dashboard.readiness} />
        <NoticeBanner notice={dashboard.notice} />
        <div className="mt-4">
          <DashboardMainColumn dashboard={dashboard} />
        </div>
      </section>

      <DashboardDiagnostics dashboard={dashboard} />
      <DashboardDialogs dashboard={dashboard} />
    </AppShell>
  );
}
