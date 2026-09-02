import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");

function source(path: string): string {
  return readFileSync(join(sourceDirectory, path), "utf8");
}

describe("dashboard information architecture", () => {
  it("keeps Settings grouped by functional local navigation instead of a long section stack", () => {
    const settings = source("pages/settings/SettingsPage.tsx");

    for (const label of ["Access", "Messaging", "Webhooks", "Sessions"]) {
      expect(settings).toContain(`label: \"${label}\"`);
    }
    for (const id of ["settings-access", "settings-messaging", "settings-webhooks", "settings-sessions"]) {
      expect(settings).toContain(id);
    }

    expect(settings).toContain('aria-label="Settings sections"');
    expect(settings).toContain("max-w-[1120px]");
    expect(settings).toContain("lg:grid-cols-[168px_minmax(0,880px)]");
    expect(settings).not.toContain("max-w-[820px]");
    expect(settings).not.toContain("Application integration");
    expect(settings).not.toContain("Outbound policy");
    expect(settings).not.toContain("Delivery integration");
    expect(settings).not.toContain("Operator access");
  });

  it("keeps WhatsApp connection and account health inside one Control module", () => {
    const mainColumn = source("pages/dashboard/DashboardMainColumn.tsx");
    const whatsappModule = source("features/whatsapp/WhatsAppBindingCard.tsx");

    expect(mainColumn).toContain("WhatsAppBindingCard");
    expect(mainColumn).toContain("accountHealth={dashboard.accountHealth}");
    expect(mainColumn).not.toContain("AccountHealthCard");
    expect(whatsappModule).toContain("AccountHealthCard");
    expect(whatsappModule).toContain(">Connection<");
    expect(whatsappModule).toContain(">Account<");
  });

  it("keeps diagnostics secondary and prerequisite-aware", () => {
    const diagnostics = source("pages/dashboard/DashboardDiagnostics.tsx");

    expect(diagnostics).toContain('dashboard.status === "connected"');
    expect(diagnostics).toContain("Diagnostics unavailable");
    expect(diagnostics).toContain("Connect WhatsApp before running an outbound delivery diagnostic.");
    expect(diagnostics).toContain("<details");
  });

  it("keeps webhook configuration and delivery activity in one module", () => {
    const webhook = source("features/settings/WebhookSettingsCard.tsx");
    const deliveryActivity = source("features/settings/WebhookDeliveryDiagnostics.tsx");

    expect(webhook).toContain("WebhookDeliveryDiagnostics");
    expect(webhook).toContain("Incoming messages");
    expect(webhook).toContain("Message accepted");
    expect(webhook).toContain("Message rejected");
    expect(deliveryActivity).toContain("Delivery activity");
  });
});
