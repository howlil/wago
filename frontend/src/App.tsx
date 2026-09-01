import { useEffect, useState } from "react";
import { AccessGate } from "./features/access/AccessGate.js";
import { AuditPage } from "./pages/audit/AuditPage.js";
import { DashboardPage } from "./pages/dashboard/DashboardPage.js";
import { SettingsPage } from "./pages/settings/SettingsPage.js";
import type { WorkspacePath } from "./shared/layout/AppSidebar.js";
import { TooltipProvider } from "./shared/ui/tooltip.js";

const workspacePaths = new Set<WorkspacePath>(["/", "/settings", "/audit"]);

function currentLocationKey(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

function currentPath(): WorkspacePath {
  if (typeof window === "undefined") return "/";
  return workspacePaths.has(window.location.pathname as WorkspacePath)
    ? (window.location.pathname as WorkspacePath)
    : "/";
}

function AuthenticatedApp() {
  const [locationKey, setLocationKey] = useState(currentLocationKey);
  const path = currentPath();

  useEffect(() => {
    const syncLocation = () => setLocationKey(currentLocationKey());
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || !workspacePaths.has(destination.pathname as WorkspacePath))
        return;

      const nextLocation = `${destination.pathname}${destination.search}`;
      if (nextLocation === currentLocationKey()) return;

      event.preventDefault();
      window.history.pushState(null, "", nextLocation);
      syncLocation();
    };

    window.addEventListener("popstate", syncLocation);
    document.addEventListener("click", handleDocumentClick);
    return () => {
      window.removeEventListener("popstate", syncLocation);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  if (path === "/audit") {
    return <AuditPage key={locationKey} />;
  }
  if (path === "/settings") {
    return <SettingsPage key={locationKey} />;
  }
  return <DashboardPage key={locationKey} />;
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
