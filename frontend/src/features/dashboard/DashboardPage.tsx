import type { WhatsAppStatus } from "../../api.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";
import type { BackendHealthState } from "../../shared/types/status.js";
import { FirstRunSetupDialog } from "../gateway/FirstRunSetupDialog.js";
import { GatewayCredentialsCard } from "../gateway/GatewayCredentialsCard.js";
import { RotateApiKeyDialog } from "../gateway/RotateApiKeyDialog.js";
import { MessageStatusCard } from "../messages/MessageStatusCard.js";
import { SendMessageCard } from "../messages/SendMessageCard.js";
import { RecipientAccessCard } from "../recipients/RecipientAccessCard.js";
import { AccountHealthCard } from "../whatsapp/AccountHealthCard.js";
import { RebindSessionDialog } from "../whatsapp/RebindSessionDialog.js";
import { WhatsAppBindingCard } from "../whatsapp/WhatsAppBindingCard.js";
import { OperationalReadinessBanner } from "./OperationalReadinessBanner.js";
import { OverviewCards } from "./OverviewCards.js";
import { useDashboardController } from "./useDashboardController.js";

const statusLabel: Record<WhatsAppStatus, string> = {
  connecting: "Connecting",
  qr: "Waiting for QR",
  connected: "Connected",
  disconnected: "Disconnected",
};
function getHeaderStatus(health: BackendHealthState, status: WhatsAppStatus) {
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
  const activeQrImage = dashboard.hasQr && dashboard.status !== "connected" ? dashboard.qrImage : null;
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
      <OperationalReadinessBanner />
      <NoticeBanner notice={dashboard.notice} />
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-4">
          <WhatsAppBindingCard
            health={dashboard.health}
            status={dashboard.status}
            binding={dashboard.binding}
            qrImage={activeQrImage}
            connectionDescription={dashboard.connectionDescription}
            canStartPairing={dashboard.canStartPairing}
            pairingInProgress={dashboard.pairingInProgress}
            pairButtonLabel={dashboard.pairButtonLabel}
            isPairing={dashboard.isPairing}
            isRebinding={dashboard.isRebinding}
            onPair={() => void dashboard.handlePair()}
            onChangeAccount={dashboard.openRebindDialog}
          />
          <SendMessageCard
            status={dashboard.status}
            phone={dashboard.phone}
            message={dashboard.message}
            isSending={dashboard.isSending}
            canSend={dashboard.canSend}
            approvalRequired={dashboard.approvalRequired}
            onPhoneChange={dashboard.handlePhoneChange}
            onMessageChange={dashboard.setMessage}
            onSubmit={dashboard.handleSubmit}
            onAllowAndSend={dashboard.allowAndSend}
          />
          {dashboard.lastMessage ? (
            <MessageStatusCard messageId={dashboard.lastMessage.id} initialStatus={dashboard.lastMessage.status} />
          ) : null}
          <RecipientAccessCard
            enabled={dashboard.isAuthenticated}
            refreshKey={dashboard.recipientRefreshKey}
            suggestedPhone={dashboard.recipientApprovalPhone}
            onAllowed={dashboard.handleRecipientAllowed}
          />
        </div>
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
              <p className="mb-0 mt-1 text-xs leading-5 text-wago-muted">
                Available after the gateway is authenticated.
              </p>
            </section>
          )}
        </div>
      </div>
      <FirstRunSetupDialog
        isOpen={dashboard.isSetupCodeDialogOpen}
        setupCode={dashboard.setupCodeInput}
        isSubmitting={dashboard.isPairing}
        errorMessage={dashboard.setupCodeError}
        onSetupCodeChange={dashboard.setSetupCodeInput}
        onCancel={dashboard.closeSetupCodeDialog}
        onConfirm={() => void dashboard.handleConfirmSetupCode()}
      />
      <RotateApiKeyDialog
        isOpen={dashboard.isApiKeyRotationDialogOpen}
        isRotating={dashboard.isRotatingApiKey}
        onCancel={dashboard.closeApiKeyRotationDialog}
        onConfirm={() => void dashboard.handleRotateApiKey()}
      />
      <RebindSessionDialog
        isOpen={dashboard.isRebindDialogOpen}
        isRebinding={dashboard.isRebinding}
        onCancel={dashboard.closeRebindDialog}
        onConfirm={() => void dashboard.handleRebind()}
      />
    </AppShell>
  );
}
