import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { RebindSessionDialog } from "../../features/whatsapp/RebindSessionDialog.js";

type DashboardDialogsProps = {
  dashboard: DashboardController;
};

export function DashboardDialogs({ dashboard }: DashboardDialogsProps) {
  return (
    <RebindSessionDialog
      isOpen={dashboard.isRebindDialogOpen}
      isRebinding={dashboard.isRebinding}
      onCancel={dashboard.closeRebindDialog}
      onConfirm={() => void dashboard.handleRebind()}
    />
  );
}
