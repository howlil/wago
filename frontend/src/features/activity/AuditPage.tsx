import { AppShell } from "../../shared/components/AppShell.js";
import { ActivityLogPanel } from "./ActivityLogPanel.js";

export function AuditPage() {
  return (
    <AppShell
      title="Audit Log"
      description="Review sanitized gateway and WhatsApp lifecycle events."
      activePath="/audit"
    >
      <ActivityLogPanel enabled heading="Operational history" />
    </AppShell>
  );
}
