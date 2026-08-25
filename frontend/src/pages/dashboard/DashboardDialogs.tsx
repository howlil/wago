import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { RotateApiKeyDialog } from "../../features/gateway/RotateApiKeyDialog.js";
import { RebindSessionDialog } from "../../features/whatsapp/RebindSessionDialog.js";

type DashboardDialogsProps = { dashboard: DashboardController };

export function DashboardDialogs({ dashboard }: DashboardDialogsProps) {
  return (
    <>
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
