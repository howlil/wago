import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { GatewayCredentialsCard } from "../../features/gateway/GatewayCredentialsCard.js";
import { RecipientAccessCard } from "../../features/recipients/RecipientAccessCard.js";

type DashboardSideColumnProps = {
  dashboard: DashboardController;
};

export function DashboardSideColumn({ dashboard }: DashboardSideColumnProps) {
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <GatewayCredentialsCard
        appId={dashboard.appId}
        apiKeyConfigured={dashboard.apiKeyConfigured}
        apiKeySource={dashboard.apiKeySource}
        apiKeyInput={dashboard.apiKeyInput}
        credentialSetupRequired={dashboard.credentialSetupRequired}
        showApiKey={dashboard.showApiKey}
        copiedField={dashboard.copiedField}
        credentialHint={dashboard.credentialHint}
        isGeneratingApiKey={dashboard.isGeneratingApiKey}
        isSigningOut={dashboard.isSigningOut}
        isSigningOutAll={dashboard.isSigningOutAll}
        isRotatingApiKey={dashboard.isRotatingApiKey}
        onToggleApiKey={dashboard.toggleApiKey}
        onCopyAppId={dashboard.copyAppId}
        onCopyApiKey={dashboard.copyApiKey}
        onGenerateApiKey={() => void dashboard.handleGenerateApiKey()}
        onSignOut={() => void dashboard.handleSignOut()}
        onSignOutAll={() => void dashboard.handleSignOutAll()}
        onRotateApiKey={dashboard.openApiKeyRotationDialog}
      />
      <RecipientAccessCard
        enabled={dashboard.isAuthenticated}
        refreshKey={dashboard.recipientRefreshKey}
        suggestedPhone={dashboard.recipientApprovalPhone}
        onAllowed={dashboard.handleRecipientAllowed}
      />
    </div>
  );
}
