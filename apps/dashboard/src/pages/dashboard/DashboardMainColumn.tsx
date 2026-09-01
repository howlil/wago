import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { AccountHealthCard } from "../../features/whatsapp/AccountHealthCard.js";
import { WhatsAppBindingCard } from "../../features/whatsapp/WhatsAppBindingCard.js";

type DashboardMainColumnProps = {
  dashboard: DashboardController;
};

export function DashboardMainColumn({ dashboard }: DashboardMainColumnProps) {
  const activeQrImage = dashboard.hasQr && dashboard.status !== "connected" ? dashboard.qrImage : null;

  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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
