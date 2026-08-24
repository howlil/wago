import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { FirstRunSetupDialog } from "../../features/gateway/FirstRunSetupDialog.js";
import { RotateApiKeyDialog } from "../../features/gateway/RotateApiKeyDialog.js";
import { RebindSessionDialog } from "../../features/whatsapp/RebindSessionDialog.js";

type DashboardDialogsProps = {
  dashboard: DashboardController;
};

export function DashboardDialogs({ dashboard }: DashboardDialogsProps) {
  return (
    <>
      <FirstRunSetupDialog
        isOpen={dashboard.isFirstRunSetupDialogOpen}
        setupCode={dashboard.setupCodeInput}
        isSubmitting={dashboard.isPairing}
        errorMessage={dashboard.setupCodeError}
        onSetupCodeChange={dashboard.setSetupCodeInput}
        onCancel={dashboard.closeFirstRunSetupDialog}
        onConfirm={() => void dashboard.handleConfirmFirstRunSetup()}
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
    </>
  );
}
