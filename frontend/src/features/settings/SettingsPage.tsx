import { AppShell } from "../../shared/components/AppShell.js";
import { WebhookSettingsCard } from "./WebhookSettingsCard.js";

export function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      description="Configure gateway integrations and operator-facing behavior."
      activePath="/settings"
    >
      <div className="grid w-full max-w-[720px] gap-4">
        <WebhookSettingsCard />
      </div>
    </AppShell>
  );
}
