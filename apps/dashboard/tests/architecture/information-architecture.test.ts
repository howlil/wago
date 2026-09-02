import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");

function source(path: string): string {
  return readFileSync(join(sourceDirectory, path), "utf8");
}

describe("dashboard information architecture", () => {
  it("shows one hash-addressable Settings module at a time", () => {
    const settings = source("pages/settings/SettingsPage.tsx");

    for (const label of ["Access", "Messaging", "Webhooks", "Sessions"]) {
      expect(settings).toContain(`label: \"${label}\"`);
    }
    for (const module of ["access", "messaging", "webhooks", "sessions"]) {
      expect(settings).toContain(`activeModule === \"${module}\"`);
      expect(settings).toContain(`href: \"#${module}\"`);
    }

    expect(settings).toContain('aria-label="Settings sections"');
    expect(settings).toContain("aria-current={active ? \"page\" : undefined}");
    expect(settings).toContain("hashchange");
    expect(settings).toContain("max-w-[1120px]");
    expect(settings).toContain("lg:grid-cols-[168px_minmax(0,880px)]");
    expect(settings).not.toContain("settings-access");
    expect(settings).not.toContain("max-w-[820px]");
  });

  it("keeps WhatsApp connection and account health inside one Control module", () => {
    const mainColumn = source("pages/dashboard/DashboardMainColumn.tsx");
    const whatsappModule = source("features/whatsapp/WhatsAppBindingCard.tsx");
    const control = source("pages/dashboard/DashboardPage.tsx");
    const overview = source("features/dashboard/OverviewCards.tsx");

    expect(mainColumn).toContain("WhatsAppBindingCard");
    expect(mainColumn).toContain("accountHealth={dashboard.accountHealth}");
    expect(mainColumn).not.toContain("AccountHealthCard");
    expect(whatsappModule).toContain("AccountHealthCard");
    expect(overview).toContain('label: "Messaging"');
    expect(overview).toContain('value: "Waiting"');
    expect(control).not.toContain("IntegrationNextStep");
  });

  it("keeps diagnostics secondary and prerequisite-aware", () => {
    const diagnostics = source("pages/dashboard/DashboardDiagnostics.tsx");

    expect(diagnostics).toContain('dashboard.status === "connected"');
    expect(diagnostics).toContain("Diagnostics unavailable");
    expect(diagnostics).toContain("Connect WhatsApp before running an outbound delivery diagnostic.");
    expect(diagnostics).toContain("<details");
  });

  it("keeps Webhooks cohesive without nested selected-delivery cards", () => {
    const webhook = source("features/settings/WebhookSettingsCard.tsx");
    const deliveryActivity = source("features/settings/WebhookDeliveryDiagnostics.tsx");

    expect(webhook).toContain("WebhookDeliveryDiagnostics");
    expect(webhook).toContain("Supported events");
    expect(webhook).toContain("3 events");
    expect(deliveryActivity).toContain("Delivery activity");
    expect(deliveryActivity).toContain("Collapse delivery details");
    expect(deliveryActivity).not.toContain("Selected delivery");
  });

  it("keeps machine-access empty state free of disabled credential chrome", () => {
    const credentials = source("features/gateway/GatewayCredentialsCard.tsx");

    expect(credentials).toContain("Not generated");
    expect(credentials).toContain("New API key");
    expect(credentials).not.toContain("apiKeySource");
    expect(credentials).not.toContain('placeholder={credentialSetupRequired');
  });

  it("keeps Audit Log as a flat operational console", () => {
    const panel = source("features/activity/ActivityLogPanel.tsx");
    const list = source("features/activity/ActivityEventList.tsx");

    expect(panel).not.toContain("cardBodyClass");
    expect(list).not.toContain("rounded-lg border border-wago-line bg-white");
    expect(panel).toContain("border-y border-wago-line");
    expect(list).toContain("border-y border-wago-line");
  });

  it("does not render a redundant Workspace label in global navigation", () => {
    const sidebar = source("shared/layout/AppSidebar.tsx");
    expect(sidebar).not.toContain(">Workspace<");
  });
});
