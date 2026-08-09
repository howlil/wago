import { DashboardShell } from "../../shared/components/DashboardShell.js";
import { NoticeBanner } from "../../shared/components/NoticeBanner.js";
import { OverviewCards } from "../../shared/components/OverviewCards.js";
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
      isRefreshing={dashboard.isRefreshing}
      onRefresh={() => void dashboard.refresh({ showLoading: true })}
    >
      <OverviewCards health={dashboard.health} status={dashboard.status} accountHealth={dashboard.accountHealth} />
      <NoticeBanner notice={dashboard.notice} />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <div className="grid gap-5">
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

          {dashboard.hasQr && dashboard.qrImage && dashboard.status !== "connected" ? (
            <QrPairingCard qrImage={dashboard.qrImage} />
          ) : null}

          <RecipientAccessCard
            enabled={dashboard.isAuthenticated}
            refreshKey={dashboard.recipientRefreshKey}
            suggestedPhone={dashboard.recipientApprovalPhone}
            onAllowed={dashboard.handleRecipientAllowed}
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
        </div>

        <aside className="grid gap-5 xl:sticky xl:top-28">
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

          {dashboard.isAuthenticated ? <AccountHealthCard accountHealth={dashboard.accountHealth} /> : null}
        </aside>
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
