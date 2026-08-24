import { OperationalReadinessBanner } from "../../features/dashboard/OperationalReadinessBanner.js";
import { OverviewCards } from "../../features/dashboard/OverviewCards.js";
import { useDashboardController } from "../../features/dashboard/useDashboardController.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";
import type { BackendHealthState } from "../../shared/types/status.js";
import { DashboardDialogs } from "./DashboardDialogs.js";
import { DashboardMainColumn } from "./DashboardMainColumn.js";
import { DashboardSideColumn } from "./DashboardSideColumn.js";

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
      description="Manage connection, access and outbound messaging."
      activePath="/"
      statusLabel={headerStatus.label}
      statusTone={headerStatus.tone}
      isRefreshing={dashboard.isRefreshing}
      onRefresh={() => void dashboard.refresh({ showLoading: true })}
      refreshLabel="Refresh status"
    >
      <OverviewCards health={dashboard.health} status={dashboard.status} accountHealth={dashboard.accountHealth} />
      <OperationalReadinessBanner readiness={dashboard.readiness} />
      <NoticeBanner notice={dashboard.notice} />
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DashboardMainColumn dashboard={dashboard} />
        <DashboardSideColumn dashboard={dashboard} />
      </div>
      <DashboardDialogs dashboard={dashboard} />
    </AppShell>
  );
}
