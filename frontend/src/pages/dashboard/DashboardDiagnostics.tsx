import { ChevronDown } from "lucide-react";
import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { MessageStatusCard } from "../../features/messages/MessageStatusCard.js";
import { SendMessageCard } from "../../features/messages/SendMessageCard.js";

type DashboardDiagnosticsProps = {
  dashboard: DashboardController;
};

export function DashboardDiagnostics({ dashboard }: DashboardDiagnosticsProps) {
  return (
    <details className="group mt-6 border-t border-wago-line pt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md px-1 py-1.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="m-0 text-[13px] font-semibold tracking-[-0.01em] text-wago-ink">Gateway diagnostics</h2>
          <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">
            Run an end-to-end outbound test when troubleshooting delivery.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-wago-muted">
          <span>Test tools</span>
          <ChevronDown className="group-open:rotate-180" size={14} aria-hidden="true" />
        </div>
      </summary>
      <div className="mt-3 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
    </details>
  );
}
