import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { GatewayCredentialsCard } from "../../features/gateway/GatewayCredentialsCard.js";
import { AccountHealthCard } from "../../features/whatsapp/AccountHealthCard.js";

type DashboardSideColumnProps = {
  dashboard: DashboardController;
};

export function DashboardSideColumn({ dashboard }: DashboardSideColumnProps) {
  return (
    <div className="grid min-w-0 content-start gap-4">
      <GatewayCredentialsCard
        appId={dashboard.appId}
        apiKeyConfigured={dashboard.apiKeyConfigured}
        apiKeySource={dashboard.apiKeySource}
        apiKeyInput={dashboard.apiKeyInput}
        credentialSetupRequired={dashboard.credentialSetupRequired}
        isAuthenticated={dashboard.isAuthenticated}
        showApiKey={dashboard.showApiKey}
        copiedField={dashboard.copiedField}
        credentialHint={dashboard.credentialHint}
        isSigningIn={dashboard.isSigningIn}
        isSigningOut={dashboard.isSigningOut}
        isSigningOutAll={dashboard.isSigningOutAll}
        isRotatingApiKey={dashboard.isRotatingApiKey}
        onApiKeyChange={dashboard.setApiKeyInput}
        onToggleApiKey={dashboard.toggleApiKey}
        onCopyAppId={dashboard.copyAppId}
        onCopyApiKey={dashboard.copyApiKey}
        onSignIn={() => void dashboard.handleSignIn()}
        onSignOut={() => void dashboard.handleSignOut()}
        onSignOutAll={() => void dashboard.handleSignOutAll()}
        onRotateApiKey={dashboard.openApiKeyRotationDialog}
      />
      {dashboard.isAuthenticated ? (
        <AccountHealthCard accountHealth={dashboard.accountHealth} />
      ) : (
        <section className="rounded-lg border border-wago-line bg-white p-4">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-wago-ink">Account health</h2>
          <p className="mb-0 mt-1 text-xs leading-5 text-wago-muted">Available after the gateway is authenticated.</p>
        </section>
      )}
    </div>
  );
}
