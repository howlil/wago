import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");

function source(path: string): string {
  return readFileSync(join(sourceDirectory, path), "utf8");
}

function sourceFiles(directory = sourceDirectory): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry) ? [path] : [];
  });
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
    expect(settings).toContain("lg:grid-cols-[160px_minmax(0,1fr)]");
    expect(settings).toContain("<motion.a");
    expect(settings).toContain('layoutId="settings-active-surface"');
    expect(settings).toContain("bg-wago-selected");
    expect(settings).not.toContain("max-w-[1120px]");
    expect(settings).not.toContain("minmax(0,880px)");
  });

  it("uses the available desktop workspace instead of narrow page-level caps", () => {
    const control = source("pages/dashboard/DashboardPage.tsx");
    const mainColumn = source("pages/dashboard/DashboardMainColumn.tsx");
    const diagnostics = source("pages/dashboard/DashboardDiagnostics.tsx");
    const settings = source("pages/settings/SettingsPage.tsx");

    expect(control).toContain('className="w-full"');
    expect(control).not.toContain("max-w-[1180px]");
    expect(mainColumn).toContain('className="min-w-0 w-full"');
    expect(mainColumn).not.toContain("max-w-[920px]");
    expect(diagnostics).not.toContain("max-w-[780px]");
    expect(settings).toContain("minmax(0,1fr)");
  });

  it("uses one compact Control status rail without duplicate header state", () => {
    const control = source("pages/dashboard/DashboardPage.tsx");
    const overview = source("features/dashboard/OverviewCards.tsx");
    const shell = source("shared/components/AppShell.tsx");
    const header = source("shared/layout/AppHeader.tsx");

    expect(overview).toContain('aria-label="Gateway runtime status"');
    expect(overview).toContain('label: "Gateway"');
    expect(overview).toContain('label: "WhatsApp"');
    expect(overview).toContain('label: "Messaging"');
    expect(overview).toContain('value: "Waiting"');
    expect(overview).toContain("bg-wago-control-surface");
    expect(overview).toContain("border-y border-wago-workspace-line");
    expect(overview).toContain("toneSurface");
    expect(overview).not.toContain("rounded-lg");
    expect(overview).not.toContain("bg-white px-4 py-3.5");
    expect(control).not.toContain("statusLabel=");
    expect(control).not.toContain("statusTone=");
    expect(control).not.toContain("description=");
    expect(shell).not.toContain("statusLabel");
    expect(shell).not.toContain("statusTone");
    expect(shell).not.toContain("description:");
    expect(header).not.toContain("statusLabel");
    expect(header).not.toContain("statusTone");
    expect(header).not.toContain("description:");
  });

  it("keeps WhatsApp connection and account health in a compact divider-led workbench", () => {
    const mainColumn = source("pages/dashboard/DashboardMainColumn.tsx");
    const whatsappModule = source("features/whatsapp/WhatsAppBindingCard.tsx");
    const accountHealth = source("features/whatsapp/AccountHealthCard.tsx");
    const pairing = source("features/whatsapp/QrPairingCard.tsx");

    expect(mainColumn).toContain("WhatsAppBindingCard");
    expect(mainColumn).toContain("accountHealth={dashboard.accountHealth}");
    expect(whatsappModule).toContain("workspaceModuleClass");
    expect(whatsappModule).toContain("AccountHealthCard");
    expect(whatsappModule).toContain("py-3");
    expect(whatsappModule).not.toContain("cardBodyClass");
    expect(accountHealth).toContain("md:grid-cols-3");
    expect(accountHealth).toContain("border-wago-workspace-line py-3");
    expect(accountHealth).toContain("New chats");
    expect(accountHealth).toContain("New-recipient sends remain allowed until a cap is reported.");
    expect(pairing).toContain("rounded-md border border-wago-line bg-wago-surface-subtle");
    expect(pairing).not.toContain("QrCode");
    expect(pairing).not.toContain("bg-[#");
  });

  it("keeps diagnostics secondary, compact, and prerequisite-aware", () => {
    const diagnostics = source("pages/dashboard/DashboardDiagnostics.tsx");

    expect(diagnostics).toContain('dashboard.status === "connected"');
    expect(diagnostics).toContain("Diagnostics unavailable");
    expect(diagnostics).toContain("Connect WhatsApp before running an outbound delivery diagnostic.");
    expect(diagnostics).toContain("mt-4 border-t border-wago-workspace-line pt-2");
    expect(diagnostics).toContain("<details");
  });

  it("uses semantic workspace surfaces instead of giant routine cards", () => {
    const classes = source("shared/ui/classes.ts");

    expect(classes).toContain("border-l-2 border-wago-workspace-line bg-wago-workspace");
    expect(classes).not.toContain("workspaceModuleClass = \"rounded");
    expect(classes).not.toContain("workspaceModuleClass = \"shadow");

    for (const path of [
      "features/gateway/GatewayCredentialsCard.tsx",
      "features/recipients/RecipientAccessCard.tsx",
      "features/access/OperatorSessionCard.tsx",
      "features/settings/WebhookSettingsCard.tsx",
    ]) {
      const module = source(path);
      expect(module).toContain("workspaceModuleClass");
      expect(module).not.toContain("cardBodyClass");
    }
  });

  it("keeps Webhooks cohesive as configuration plus delivery regions", () => {
    const webhook = source("features/settings/WebhookSettingsCard.tsx");
    const deliveryActivity = source("features/settings/WebhookDeliveryDiagnostics.tsx");

    expect(webhook).toContain("WebhookDeliveryDiagnostics");
    expect(webhook).toContain("Configuration");
    expect(webhook).toContain("Supported events");
    expect(webhook).toContain("7 events");
    expect(webhook).toContain("message.media_received");
    expect(webhook).toContain("message.delivered");
    expect(webhook).toContain("message.read");
    expect(webhook).toContain("message.played");
    expect(webhook).toContain("xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]");
    expect(webhook).not.toContain("cardBodyClass");
    expect(deliveryActivity).toContain("Delivery activity");
    expect(deliveryActivity).toContain("Collapse delivery details");
    expect(deliveryActivity).not.toContain("Selected delivery");
  });

  it("keeps machine-access empty state free of disabled credential chrome", () => {
    const credentials = source("features/gateway/GatewayCredentialsCard.tsx");

    expect(credentials).toContain("Not generated");
    expect(credentials).toContain("New API key");
    expect(credentials).toContain("xl:grid-cols-2");
    expect(credentials).not.toContain("apiKeySource");
    expect(credentials).not.toContain('placeholder={credentialSetupRequired');
  });

  it("keeps authentication bounded without startup-card decoration", () => {
    const access = source("features/access/AccessGate.tsx");

    expect(access).toContain("rounded-md border border-wago-line bg-wago-surface p-6");
    expect(access).toContain("border-y border-wago-line py-5");
    expect(access).not.toContain("rounded-xl");
    expect(access).not.toContain("shadow-sm");
    expect(access).not.toContain("h-11 w-11");
    expect(access).not.toContain("bg-[#");
  });

  it("uses readable recipient status text instead of tiny status pills", () => {
    const recipients = source("features/recipients/RecipientList.tsx");
    const status = source("features/recipients/utils.ts");

    expect(recipients).toContain("dotClassName");
    expect(recipients).toContain("text-xs font-medium");
    expect(recipients).not.toContain("text-[9px]");
    expect(recipients).not.toContain("rounded px-1.5 py-0.5");
    expect(status).toContain("text-wago-positive");
    expect(status).not.toContain("#");
  });

  it("does not use 9px text for normal dashboard UI", () => {
    for (const path of sourceFiles()) {
      expect(readFileSync(path, "utf8"), path).not.toContain("text-[9px]");
    }
  });

  it("keeps migrated high-traffic surfaces on semantic color tokens", () => {
    for (const path of [
      "features/access/AccessGate.tsx",
      "features/whatsapp/WhatsAppBindingCard.tsx",
      "features/whatsapp/QrPairingCard.tsx",
      "features/recipients/RecipientAccessCard.tsx",
      "features/recipients/RecipientList.tsx",
      "features/recipients/utils.ts",
      "shared/components/NoticeBanner.tsx",
    ]) {
      expect(source(path), path).not.toContain("[#");
    }
  });

  it("keeps workspace, selected state, control rail, and console rows on semantic tokens", () => {
    const styles = source("styles.css");
    const classes = source("shared/ui/classes.ts");
    const sidebar = source("shared/layout/AppSidebar.tsx");

    for (const token of [
      "--color-wago-workspace:",
      "--color-wago-workspace-strong:",
      "--color-wago-workspace-line:",
      "--color-wago-control-surface:",
      "--color-wago-selected:",
      "--color-wago-selected-line:",
      "--color-wago-console-row:",
      "--color-wago-console-row-hover:",
    ]) {
      expect(styles).toContain(token);
    }
    expect(classes).toContain("bg-wago-workspace");
    expect(sidebar).toContain("bg-wago-selected");
  });

  it("keeps Audit Log dense, single-heading, paginated, and progressively disclosed", () => {
    const page = source("pages/audit/AuditPage.tsx");
    const panel = source("features/activity/ActivityLogPanel.tsx");
    const list = source("features/activity/ActivityEventList.tsx");

    expect(page).not.toContain("Operational history");
    expect(panel).not.toContain("cardBodyClass");
    expect(panel).toContain("xl:grid-cols-[minmax(280px,1fr)_140px_150px_130px_auto]");
    expect(panel).toContain("useState(20)");
    expect(panel).toContain("Rows per page");
    expect(panel).toContain("Audit pagination");
    expect(panel).toContain("Load more");
    expect(list).toContain("bg-wago-console-row");
    expect(list).toContain("px-2.5 py-2");
    expect(list).toContain("AnimatePresence");
    expect(list).toContain("height: \"auto\"");
    expect(list).not.toContain("rounded-lg border border-wago-line bg-white");
  });

  it("keeps global and Settings navigation rule-led with state continuity motion", () => {
    const sidebar = source("shared/layout/AppSidebar.tsx");
    const settings = source("pages/settings/SettingsPage.tsx");
    const app = source("App.tsx");

    expect(sidebar).toContain("<motion.a");
    expect(sidebar).toContain("global-active-surface");
    expect(sidebar).toContain("bg-wago-selected");
    expect(sidebar).toContain("w-0.5 bg-wago-brand");
    expect(settings).toContain('layoutId="settings-active-rule"');
    expect(settings).toContain("initial={{ opacity: 0.86 }}");
    expect(sidebar).not.toContain("bg-wago-brand-soft text-wago-brand-strong");
    expect(sidebar).not.toContain(">Workspace<");
    expect(app).toContain('<MotionConfig reducedMotion="user">');
  });

  it("keeps the shell compact without reducing collapsed navigation targets", () => {
    const shell = source("shared/components/AppShell.tsx");
    const header = source("shared/layout/AppHeader.tsx");
    const sidebar = source("shared/layout/AppSidebar.tsx");
    const classes = source("shared/ui/classes.ts");

    expect(header).toContain("min-h-12");
    expect(shell).toContain("pb-6 pt-3");
    expect(sidebar).toContain("h-10");
    expect(classes).toContain("h-8");
  });

  it("guards high-traffic operator surfaces against generic AI-SaaS decoration", () => {
    const paths = [
      "shared/layout/AppSidebar.tsx",
      "shared/layout/AppHeader.tsx",
      "pages/settings/SettingsPage.tsx",
      "features/dashboard/OverviewCards.tsx",
      "features/activity/ActivityLogPanel.tsx",
      "features/activity/ActivityEventList.tsx",
    ];
    const prohibited = ["rounded-xl", "shadow-", "bg-gradient", "backdrop-blur", "hover:-translate-y", "drop-shadow"];

    for (const path of paths) {
      const content = source(path);
      for (const pattern of prohibited) {
        expect(content, `${path} should not contain ${pattern}`).not.toContain(pattern);
      }
    }
  });
});
