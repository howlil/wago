import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { WhatsAppBindingCard } from "../../features/whatsapp/WhatsAppBindingCard.js";

type DashboardMainColumnProps = {
  dashboard: DashboardController;
};

export function DashboardMainColumn({ dashboard }: DashboardMainColumnProps) {
  const activeQrImage = dashboard.hasQr && dashboard.status !== "connected" ? dashboard.qrImage : null;

  return (
    <div className="min-w-0 max-w-[920px]">
      <WhatsAppBindingCard
        health={dashboard.health}
        status={dashboard.status}
        binding={dashboard.binding}
        accountHealth={dashboard.accountHealth}
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
    </div>
  );
}
