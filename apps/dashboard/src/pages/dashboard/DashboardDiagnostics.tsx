import { ChevronDown } from "lucide-react";
import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { MessageStatusCard } from "../../features/messages/MessageStatusCard.js";
import { SendMessageCard } from "../../features/messages/SendMessageCard.js";

type DashboardDiagnosticsProps = {
  dashboard: DashboardController;
};

export function DashboardDiagnostics({ dashboard }: DashboardDiagnosticsProps) {
  const diagnosticsLayout = dashboard.lastMessage
    ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]"
    : "w-full";
  const canOpenSendTool = dashboard.status === "connected";

  return (
    <details className="group mt-6 border-t border-wago-line pt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md px-1 py-1.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="m-0 text-[13px] font-semibold tracking-[-0.01em] text-wago-ink">Gateway diagnostics</h2>
          <p className="mb-0 mt-0.5 text-xs leading-5 text-wago-muted">
            Secondary tools for end-to-end delivery troubleshooting.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-wago-muted">
          <span>Diagnostics</span>
          <ChevronDown className="group-open:rotate-180" size={14} aria-hidden="true" />
        </div>
      </summary>

      {!canOpenSendTool ? (
        <div className="mt-3 w-full rounded-md border border-wago-line bg-white px-4 py-3">
          <strong className="block text-xs font-semibold text-wago-ink">Diagnostics unavailable</strong>
          <p className="mb-0 mt-1 max-w-prose text-xs leading-5 text-wago-muted">
            Connect WhatsApp before running an outbound delivery diagnostic.
          </p>
        </div>
      ) : (
        <div className={`mt-3 ${diagnosticsLayout}`}>
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
      )}
    </details>
  );
}
