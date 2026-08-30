import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { GatewayCredentialsCard } from "../../features/gateway/GatewayCredentialsCard.js";
import { RecipientAccessCard } from "../../features/recipients/RecipientAccessCard.js";

type DashboardSideColumnProps = { dashboard: DashboardController };

export function DashboardSideColumn({ dashboard }: DashboardSideColumnProps) {
  return (
    <div className="grid min-w-0 content-start gap-4">
      <GatewayCredentialsCard
        appId={dashboard.appId}
        apiKeyConfigured={dashboard.apiKeyConfigured}
        apiKeySource={dashboard.apiKeySource}
        adminPasswordConfigured={dashboard.adminPasswordConfigured}
        signInCredential={dashboard.signInCredential}
        apiKeyInput={dashboard.apiKeyInput}
        credentialSetupRequired={dashboard.credentialSetupRequired}
        isAuthenticated={dashboard.isAuthenticated}
        showSignInCredential={dashboard.showSignInCredential}
        showApiKey={dashboard.showApiKey}
        copiedField={dashboard.copiedField}
        credentialHint={dashboard.credentialHint}
        signInHint={dashboard.signInHint}
        isSigningIn={dashboard.isSigningIn}
        isSigningOut={dashboard.isSigningOut}
        isSigningOutAll={dashboard.isSigningOutAll}
        isRotatingApiKey={dashboard.isRotatingApiKey}
        onSignInCredentialChange={dashboard.setSignInCredential}
        onToggleSignInCredential={dashboard.toggleSignInCredential}
        onToggleApiKey={dashboard.toggleApiKey}
        onCopyAppId={dashboard.copyAppId}
        onCopyApiKey={dashboard.copyApiKey}
        onSignIn={() => void dashboard.handleSignIn()}
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
