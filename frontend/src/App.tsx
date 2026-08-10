import { AuditPage } from "./features/activity/AuditPage.js";
import { DashboardPage } from "./features/dashboard/DashboardPage.js";

function currentWorkspacePath(): "/" | "/audit" {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/audit" ? "/audit" : "/";
}

export function App() {
  return currentWorkspacePath() === "/audit" ? <AuditPage /> : <DashboardPage />;
}
