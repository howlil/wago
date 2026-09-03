import { OperationalReadinessBanner } from "../../features/dashboard/OperationalReadinessBanner.js";
import { OverviewCards } from "../../features/dashboard/OverviewCards.js";
import { useDashboardController } from "../../features/dashboard/useDashboardController.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";
import { DashboardDiagnostics } from "./DashboardDiagnostics.js";
import { DashboardDialogs } from "./DashboardDialogs.js";
import { DashboardMainColumn } from "./DashboardMainColumn.js";

export function DashboardPage() {
  const dashboard = useDashboardController();

  return (
    <AppShell
      title="Control"
      activePath="/"
      isRefreshing={dashboard.isRefreshing}
      onRefresh={() => void dashboard.refresh({ showLoading: true })}
      refreshLabel="Refresh status"
    >
      <div className="w-full">
        <OverviewCards health={dashboard.health} status={dashboard.status} accountHealth={dashboard.accountHealth} />
        <OperationalReadinessBanner readiness={dashboard.readiness} />
        <NoticeBanner notice={dashboard.notice} />
        <div className="mt-5">
          <DashboardMainColumn dashboard={dashboard} />
        </div>
        <DashboardDiagnostics dashboard={dashboard} />
      </div>
      <DashboardDialogs dashboard={dashboard} />
    </AppShell>
  );
}
