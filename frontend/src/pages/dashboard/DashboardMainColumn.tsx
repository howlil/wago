import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { MessageStatusCard } from "../../features/messages/MessageStatusCard.js";
import { SendMessageCard } from "../../features/messages/SendMessageCard.js";
import { RecipientAccessCard } from "../../features/recipients/RecipientAccessCard.js";
import { WhatsAppBindingCard } from "../../features/whatsapp/WhatsAppBindingCard.js";

type DashboardMainColumnProps = {
  dashboard: DashboardController;
};

export function DashboardMainColumn({ dashboard }: DashboardMainColumnProps) {
  const activeQrImage = dashboard.hasQr && dashboard.status !== "connected" ? dashboard.qrImage : null;

  return (
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
  );
}
