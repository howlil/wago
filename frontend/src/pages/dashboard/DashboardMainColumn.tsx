import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { AccountHealthCard } from "../../features/whatsapp/AccountHealthCard.js";
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
      <AccountHealthCard accountHealth={dashboard.accountHealth} />
    </div>
  );
}
