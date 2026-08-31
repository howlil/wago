import type { ReactNode } from "react";
import { OperatorSessionCard } from "../../features/access/OperatorSessionCard.js";
import { useDashboardController } from "../../features/dashboard/useDashboardController.js";
import { GatewayCredentialsCard } from "../../features/gateway/GatewayCredentialsCard.js";
import { RotateApiKeyDialog } from "../../features/gateway/RotateApiKeyDialog.js";
import { RecipientAccessCard } from "../../features/recipients/RecipientAccessCard.js";
import { WebhookDeliveryDiagnostics } from "../../features/settings/WebhookDeliveryDiagnostics.js";
import { WebhookSettingsCard } from "../../features/settings/WebhookSettingsCard.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";

type SettingsSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="m-0 text-[13px] font-semibold tracking-[-0.01em] text-wago-ink">{title}</h2>
        <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const settings = useDashboardController();

  return (
    <AppShell
      title="Settings"
      description="Configure application access, outbound policy and gateway integrations."
      activePath="/settings"
    >
      <NoticeBanner notice={settings.notice} />

      <div className="grid w-full max-w-[820px] gap-6">
        <SettingsSection
          title="Application integration"
          description="Credentials external services use to call the Wago HTTP API."
        >
          <GatewayCredentialsCard
            appId={settings.appId}
            apiKeyConfigured={settings.apiKeyConfigured}
            apiKeySource={settings.apiKeySource}
            apiKeyInput={settings.apiKeyInput}
            credentialSetupRequired={settings.credentialSetupRequired}
            showApiKey={settings.showApiKey}
            copiedField={settings.copiedField}
            credentialHint={settings.credentialHint}
            isGeneratingApiKey={settings.isGeneratingApiKey}
            isRotatingApiKey={settings.isRotatingApiKey}
            onToggleApiKey={settings.toggleApiKey}
            onCopyAppId={settings.copyAppId}
            onCopyApiKey={settings.copyApiKey}
            onGenerateApiKey={() => void settings.handleGenerateApiKey()}
            onRotateApiKey={settings.openApiKeyRotationDialog}
          />
        </SettingsSection>

        <SettingsSection
          title="Outbound policy"
          description="Control which recipients applications are allowed to contact."
        >
          <RecipientAccessCard
            enabled={settings.isAuthenticated}
            refreshKey={settings.recipientRefreshKey}
            suggestedPhone={settings.recipientApprovalPhone}
            onAllowed={settings.handleRecipientAllowed}
          />
        </SettingsSection>

        <SettingsSection
          title="Delivery integration"
          description="Configure how delivery lifecycle events are sent back to your application."
        >
          <WebhookSettingsCard />
          <WebhookDeliveryDiagnostics />
        </SettingsSection>

        <SettingsSection
          title="Operator access"
          description="Manage dashboard browser sessions independently from application credentials."
        >
          <OperatorSessionCard
            isSigningOut={settings.isSigningOut}
            isSigningOutAll={settings.isSigningOutAll}
            onSignOut={() => void settings.handleSignOut()}
            onSignOutAll={() => void settings.handleSignOutAll()}
          />
        </SettingsSection>
      </div>

      <RotateApiKeyDialog
        isOpen={settings.isApiKeyRotationDialogOpen}
        isRotating={settings.isRotatingApiKey}
        onCancel={settings.closeApiKeyRotationDialog}
        onConfirm={() => void settings.handleRotateApiKey()}
      />
    </AppShell>
  );
}
