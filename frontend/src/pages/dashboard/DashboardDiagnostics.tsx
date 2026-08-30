import type { DashboardController } from "../../features/dashboard/useDashboardController.js";
import { MessageStatusCard } from "../../features/messages/MessageStatusCard.js";
import { SendMessageCard } from "../../features/messages/SendMessageCard.js";

type DashboardDiagnosticsProps = {
  dashboard: DashboardController;
};

export function DashboardDiagnostics({ dashboard }: DashboardDiagnosticsProps) {
  return (
    <section className="mt-4" aria-labelledby="gateway-diagnostics-title">
      <div className="mb-2">
        <h2 id="gateway-diagnostics-title" className="text-[13px] font-semibold tracking-[-0.01em] text-wago-ink">
          Gateway diagnostics
        </h2>
        <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">
          Send a controlled test message to verify the outbound path end to end.
        </p>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
    </section>
  );
}
