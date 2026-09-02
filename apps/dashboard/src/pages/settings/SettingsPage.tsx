import { useEffect, useState } from "react";
import { OperatorSessionCard } from "../../features/access/OperatorSessionCard.js";
import { useDashboardController } from "../../features/dashboard/useDashboardController.js";
import { GatewayCredentialsCard } from "../../features/gateway/GatewayCredentialsCard.js";
import { RotateApiKeyDialog } from "../../features/gateway/RotateApiKeyDialog.js";
import { RecipientAccessCard } from "../../features/recipients/RecipientAccessCard.js";
import { WebhookSettingsCard } from "../../features/settings/WebhookSettingsCard.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";

type SettingsModule = "access" | "messaging" | "webhooks" | "sessions";

const settingsSections = [
  { id: "access", href: "#access", label: "Access" },
  { id: "messaging", href: "#messaging", label: "Messaging" },
  { id: "webhooks", href: "#webhooks", label: "Webhooks" },
  { id: "sessions", href: "#sessions", label: "Sessions" },
] as const satisfies ReadonlyArray<{ id: SettingsModule; href: string; label: string }>;

function moduleFromHash(): SettingsModule {
  if (typeof window === "undefined") return "access";
  const candidate = window.location.hash.replace(/^#/, "") as SettingsModule;
  return settingsSections.some((section) => section.id === candidate) ? candidate : "access";
}

export function SettingsPage() {
  const settings = useDashboardController();
  const [activeModule, setActiveModule] = useState<SettingsModule>(moduleFromHash);

  useEffect(() => {
    const syncHash = () => setActiveModule(moduleFromHash());
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <AppShell
      title="Settings"
      description="Configure application access, messaging policy and gateway integrations."
      activePath="/settings"
    >
      <NoticeBanner notice={settings.notice} />

      <div className="grid w-full max-w-[1120px] items-start gap-5 lg:grid-cols-[168px_minmax(0,880px)] lg:gap-6">
        <nav
          className="grid grid-cols-2 gap-1 border-b border-wago-line pb-2 sm:grid-cols-4 lg:sticky lg:top-20 lg:grid-cols-1 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-3"
          aria-label="Settings sections"
        >
          {settingsSections.map((section) => {
            const active = section.id === activeModule;
            return (
              <a
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wago-brand/30 ${
                  active
                    ? "bg-wago-brand-soft text-wago-brand-strong"
                    : "text-wago-muted hover:bg-wago-surface-subtle hover:text-wago-ink"
                }`}
                href={section.href}
                key={section.id}
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveModule(section.id)}
              >
                {section.label}
              </a>
            );
          })}
        </nav>

        <div className="min-w-0" aria-live="polite">
          {activeModule === "access" ? (
            <GatewayCredentialsCard
              appId={settings.appId}
              apiKeyConfigured={settings.apiKeyConfigured}
              apiKeyInput={settings.apiKeyInput}
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
          ) : null}

          {activeModule === "messaging" ? (
            <RecipientAccessCard
              enabled={settings.isAuthenticated}
              refreshKey={settings.recipientRefreshKey}
              suggestedPhone={settings.recipientApprovalPhone}
              onAllowed={settings.handleRecipientAllowed}
            />
          ) : null}

          {activeModule === "webhooks" ? <WebhookSettingsCard /> : null}

          {activeModule === "sessions" ? (
            <OperatorSessionCard
              isSigningOut={settings.isSigningOut}
              isSigningOutAll={settings.isSigningOutAll}
              onSignOut={() => void settings.handleSignOut()}
              onSignOutAll={() => void settings.handleSignOutAll()}
            />
          ) : null}
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
