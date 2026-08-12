import { AuditPage } from "./features/activity/AuditPage.js";
import { DashboardPage } from "./features/dashboard/DashboardPage.js";
import { SettingsPage } from "./features/settings/SettingsPage.js";

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

export function App() {
  const path = currentPath();
  if (path === "/audit") {
    return <AuditPage />;
  }
  if (path === "/settings") {
    return <SettingsPage />;
  }
  return <DashboardPage />;
}
