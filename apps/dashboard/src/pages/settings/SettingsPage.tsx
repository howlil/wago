import { OperatorSessionCard } from "../../features/access/OperatorSessionCard.js";
import { useDashboardController } from "../../features/dashboard/useDashboardController.js";
import { GatewayCredentialsCard } from "../../features/gateway/GatewayCredentialsCard.js";
import { RotateApiKeyDialog } from "../../features/gateway/RotateApiKeyDialog.js";
import { RecipientAccessCard } from "../../features/recipients/RecipientAccessCard.js";
import { WebhookSettingsCard } from "../../features/settings/WebhookSettingsCard.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";

const settingsSections = [
  { href: "#settings-access", label: "Access" },
  { href: "#settings-messaging", label: "Messaging" },
  { href: "#settings-webhooks", label: "Webhooks" },
  { href: "#settings-sessions", label: "Sessions" },
] as const;

export function SettingsPage() {
  const settings = useDashboardController();

  return (
    <AppShell
      title="Settings"
      description="Configure application access, messaging policy and gateway integrations."
      activePath="/settings"
    >
      <NoticeBanner notice={settings.notice} />

      <div className="grid w-full max-w-[1120px] items-start gap-5 lg:grid-cols-[168px_minmax(0,880px)] lg:gap-6">
        <nav
          className="grid grid-cols-2 gap-1 rounded-lg border border-wago-line bg-white p-1.5 sm:grid-cols-4 lg:sticky lg:top-20 lg:grid-cols-1"
          aria-label="Settings sections"
        >
          {settingsSections.map((section) => (
            <a
              className="rounded-md px-3 py-2 text-xs font-medium text-wago-muted transition-colors hover:bg-wago-surface-soft hover:text-wago-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wago-brand/30"
              href={section.href}
              key={section.href}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="grid min-w-0 gap-5">
          <div id="settings-access" className="min-w-0 scroll-mt-6">
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
          </div>

          <div id="settings-messaging" className="min-w-0 scroll-mt-6">
            <RecipientAccessCard
              enabled={settings.isAuthenticated}
              refreshKey={settings.recipientRefreshKey}
              suggestedPhone={settings.recipientApprovalPhone}
              onAllowed={settings.handleRecipientAllowed}
            />
          </div>

          <div id="settings-webhooks" className="min-w-0 scroll-mt-6">
            <WebhookSettingsCard />
          </div>

          <div id="settings-sessions" className="min-w-0 scroll-mt-6">
            <OperatorSessionCard
              isSigningOut={settings.isSigningOut}
              isSigningOutAll={settings.isSigningOutAll}
              onSignOut={() => void settings.handleSignOut()}
              onSignOutAll={() => void settings.handleSignOutAll()}
            />
          </div>
        </div>
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
