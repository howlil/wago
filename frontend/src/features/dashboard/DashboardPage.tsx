import { DashboardShell } from "../../shared/components/DashboardShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";
import { OverviewCards } from "../../shared/components/OverviewCards.js";
import { ActivityLogPanel } from "../activity/ActivityLogPanel.js";
import { GatewayCredentialsCard } from "../gateway/GatewayCredentialsCard.js";
import { MessageStatusCard } from "../messages/MessageStatusCard.js";
import { SendMessageCard } from "../messages/SendMessageCard.js";
import { RecipientAccessCard } from "../recipients/RecipientAccessCard.js";
import { AccountHealthCard } from "../whatsapp/AccountHealthCard.js";
import { QrPairingCard } from "../whatsapp/QrPairingCard.js";
import { RebindSessionDialog } from "../whatsapp/RebindSessionDialog.js";
import { WhatsAppBindingCard } from "../whatsapp/WhatsAppBindingCard.js";
import { useDashboardController } from "./useDashboardController.js";

export function DashboardPage() {
  const dashboard = useDashboardController();

  return (
    <DashboardShell
      appId={dashboard.appId}
      health={dashboard.health}
      status={dashboard.status}
      binding={dashboard.binding}
      isRefreshing={dashboard.isRefreshing}
      onRefresh={() => void dashboard.refresh({ showLoading: true })}
    >
      <OverviewCards health={dashboard.health} status={dashboard.status} accountHealth={dashboard.accountHealth} />
      <NoticeBanner notice={dashboard.notice} />

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <WhatsAppBindingCard
            health={dashboard.health}
            status={dashboard.status}
            binding={dashboard.binding}
            connectionDescription={dashboard.connectionDescription}
            canStartPairing={dashboard.canStartPairing}
            pairingInProgress={dashboard.pairingInProgress}
            pairButtonLabel={dashboard.pairButtonLabel}
            isPairing={dashboard.isPairing}
            isRebinding={dashboard.isRebinding}
            onPair={() => void dashboard.handlePair()}
            onChangeAccount={dashboard.openRebindDialog}
          />
        </div>

        <div className="lg:col-span-4">
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
            onApiKeyChange={dashboard.setApiKeyInput}
            onToggleApiKey={dashboard.toggleApiKey}
            onCopyAppId={dashboard.copyAppId}
            onCopyApiKey={dashboard.copyApiKey}
            onUseApiKey={() => void dashboard.handleSaveApiKey()}
          />
        </div>

        {dashboard.hasQr && dashboard.qrImage && dashboard.status !== "connected" ? (
          <div className="lg:col-span-8">
            <QrPairingCard qrImage={dashboard.qrImage} />
          </div>
        ) : null}

        <div className="lg:col-span-8">
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
        </div>

        <div className="lg:col-span-4">
          {dashboard.isAuthenticated ? (
            <AccountHealthCard accountHealth={dashboard.accountHealth} />
          ) : (
            <div className="rounded-lg border border-dashed border-wago-line bg-white/50 p-4 text-sm text-wago-muted">
              Account health appears after the gateway is authenticated.
            </div>
          )}
        </div>

        {dashboard.lastMessage ? (
          <div className="lg:col-span-8">
            <MessageStatusCard messageId={dashboard.lastMessage.id} initialStatus={dashboard.lastMessage.status} />
          </div>
        ) : null}

        <div className="lg:col-span-12">
          <RecipientAccessCard
            enabled={dashboard.isAuthenticated}
            refreshKey={dashboard.recipientRefreshKey}
            suggestedPhone={dashboard.recipientApprovalPhone}
            onAllowed={dashboard.handleRecipientAllowed}
          />
        </div>

        <div className="lg:col-span-12">
          <ActivityLogPanel enabled={dashboard.isAuthenticated} />
        </div>
      </div>

      <RebindSessionDialog
        isOpen={dashboard.isRebindDialogOpen}
        isRebinding={dashboard.isRebinding}
        onCancel={dashboard.closeRebindDialog}
        onConfirm={() => void dashboard.handleRebind()}
      />
    </DashboardShell>
  );
}
