import { getGatewayHeaderStatus } from "../../features/dashboard/header-status.js";
import { IntegrationNextStep } from "../../features/dashboard/IntegrationNextStep.js";
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
  const headerStatus = getGatewayHeaderStatus(dashboard.health, dashboard.readiness, dashboard.status);

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
        <IntegrationNextStep status={dashboard.status} apiKeyConfigured={dashboard.apiKeyConfigured} />
      </section>

      <DashboardDiagnostics dashboard={dashboard} />
      <DashboardDialogs dashboard={dashboard} />
    </AppShell>
  );
}
