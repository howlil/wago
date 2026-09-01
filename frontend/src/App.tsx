import { AccessGate } from "./features/access/AccessGate.js";
import { AuditPage } from "./pages/audit/AuditPage.js";
import { DashboardPage } from "./pages/dashboard/DashboardPage.js";
import { SettingsPage } from "./pages/settings/SettingsPage.js";
import { TooltipProvider } from "./shared/ui/tooltip.js";

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function AuthenticatedApp() {
  const path = currentPath();
  if (path === "/audit") {
    return <AuditPage />;
  }
  if (path === "/settings") {
    return <SettingsPage />;
  }
  return <DashboardPage />;
}

export function App() {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={150}>
      <AccessGate>
        <AuthenticatedApp />
      </AccessGate>
    </TooltipProvider>
  );
}
