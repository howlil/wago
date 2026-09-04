import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { OperatorSessionCard } from "../../features/access/OperatorSessionCard.js";
import { useDashboardController } from "../../features/dashboard/useDashboardController.js";
import { GatewayCredentialsCard } from "../../features/gateway/GatewayCredentialsCard.js";
import { RotateApiKeyDialog } from "../../features/gateway/RotateApiKeyDialog.js";
import { RecipientAccessCard } from "../../features/recipients/RecipientAccessCard.js";
import { WebhookSettingsCard } from "../../features/settings/WebhookSettingsCard.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";
import { pageFrameClass } from "../../shared/ui/classes.js";

type SettingsModule = "access" | "messaging" | "webhooks" | "sessions";

const settingsSections = [
  { id: "access", href: "#access", label: "Access" },
  { id: "messaging", href: "#messaging", label: "Messaging" },
  { id: "webhooks", href: "#webhooks", label: "Webhooks" },
  { id: "sessions", href: "#sessions", label: "Sessions" },
] as const satisfies ReadonlyArray<{ id: SettingsModule; href: string; label: string }>;

const sectionNavigationMotion = { duration: 0.14, ease: "easeOut" } as const;

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
    <AppShell title="Settings" activePath="/settings">
      <div className={pageFrameClass}>
        <NoticeBanner notice={settings.notice} />

        <div className="grid w-full items-start gap-4 lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-5 2xl:grid-cols-[168px_minmax(0,1fr)]">
          <nav
            className="grid grid-cols-2 gap-1 border-b border-wago-workspace-line pb-2 sm:grid-cols-4 lg:sticky lg:top-16 lg:grid-cols-1 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-2.5"
            aria-label="Settings sections"
          >
            {settingsSections.map((section) => {
              const active = section.id === activeModule;
              return (
                <motion.a
                  className={`relative isolate flex h-9 items-center overflow-hidden px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wago-brand/30 ${
                    active ? "text-wago-ink" : "text-wago-muted hover:bg-wago-console-row-hover hover:text-wago-ink"
                  }`}
                  href={section.href}
                  key={section.id}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setActiveModule(section.id)}
                  whileHover={{ x: active ? 0 : 1 }}
                  whileTap={{ scale: 0.985 }}
                  transition={sectionNavigationMotion}
                >
                  {active ? (
                    <>
                      <motion.span
                        layoutId="settings-active-surface"
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 border-y border-wago-selected-line bg-wago-selected"
                        transition={sectionNavigationMotion}
                      />
                      <motion.span
                        layoutId="settings-active-rule"
                        aria-hidden="true"
                        className="absolute bottom-0 left-3 right-3 h-0.5 bg-wago-brand lg:inset-y-2 lg:left-0 lg:right-auto lg:h-auto lg:w-0.5"
                        transition={sectionNavigationMotion}
                      />
                    </>
                  ) : null}
                  <span className="relative z-10">{section.label}</span>
                </motion.a>
              );
            })}
          </nav>

          <motion.div
            key={activeModule}
            className="min-w-0 w-full"
            aria-live="polite"
            initial={{ opacity: 0.86 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
          >
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
          </motion.div>
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
