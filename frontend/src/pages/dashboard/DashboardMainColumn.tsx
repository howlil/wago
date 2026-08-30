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
      {dashboard.isAuthenticated ? (
        <AccountHealthCard accountHealth={dashboard.accountHealth} />
      ) : (
        <section className="rounded-lg border border-wago-line bg-white p-4">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-wago-ink">Account health</h2>
          <p className="mb-0 mt-1 text-xs leading-5 text-wago-muted">Available after the gateway is authenticated.</p>
        </section>
      )}
    </div>
  );
}
