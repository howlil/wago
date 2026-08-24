import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");

function source(path: string): string {
  return readFileSync(join(sourceDirectory, path), "utf8");
}

describe("frontend page boundary", () => {
  it("keeps route pages under src/pages instead of feature domains", () => {
    expect(existsSync(join(sourceDirectory, "pages", "dashboard", "DashboardPage.tsx"))).toBe(true);
    expect(existsSync(join(sourceDirectory, "pages", "audit", "AuditPage.tsx"))).toBe(true);
    expect(existsSync(join(sourceDirectory, "pages", "settings", "SettingsPage.tsx"))).toBe(true);
  });

  it("keeps App route imports pointed at pages", () => {
    const appSource = source("App.tsx");

    expect(appSource).toContain('./pages/audit/AuditPage.js"');
    expect(appSource).toContain('./pages/dashboard/DashboardPage.js"');
    expect(appSource).toContain('./pages/settings/SettingsPage.js"');
    expect(appSource).not.toContain("./features/activity/AuditPage.js");
    expect(appSource).not.toContain("./features/dashboard/DashboardPage.js");
    expect(appSource).not.toContain("./features/settings/SettingsPage.js");
  });

  it("keeps dashboard route composition at section level", () => {
    const pageSource = source("pages/dashboard/DashboardPage.tsx");

    expect(existsSync(join(sourceDirectory, "pages", "dashboard", "DashboardMainColumn.tsx"))).toBe(true);
    expect(existsSync(join(sourceDirectory, "pages", "dashboard", "DashboardSideColumn.tsx"))).toBe(true);
    expect(existsSync(join(sourceDirectory, "pages", "dashboard", "DashboardDialogs.tsx"))).toBe(true);
    expect(pageSource).toContain("./DashboardMainColumn.js");
    expect(pageSource).toContain("./DashboardSideColumn.js");
    expect(pageSource).toContain("./DashboardDialogs.js");
    expect(pageSource).not.toContain("../../features/gateway/");
    expect(pageSource).not.toContain("../../features/messages/");
    expect(pageSource).not.toContain("../../features/recipients/");
    expect(pageSource).not.toContain("../../features/whatsapp/");
  });
});
