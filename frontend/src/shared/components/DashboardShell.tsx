import { type ReactNode, useState } from "react";
import type { WhatsAppStatus } from "../../api.js";
import { AppHeader } from "../layout/AppHeader.js";
import { AppSidebar } from "../layout/AppSidebar.js";

type DashboardShellProps = {
  children: ReactNode;
  health: "checking" | "ok" | "error";
  status: WhatsAppStatus;
  isRefreshing: boolean;
  onRefresh: () => void;
};

const SIDEBAR_STORAGE_KEY = "wago.sidebar.collapsed";

const statusLabel: Record<WhatsAppStatus, string> = {
  connecting: "Connecting",
  qr: "Waiting for QR",
  connected: "Connected",
  disconnected: "Disconnected",
};

export function DashboardShell({ children, health, status, isRefreshing, onRefresh }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true",
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const displayStatus = health === "error" ? "Backend offline" : health === "checking" ? "Checking" : statusLabel[status];
  const statusTone =
    health === "error"
      ? "danger"
      : health === "checking"
        ? "neutral"
        : status === "connected"
          ? "positive"
          : status === "qr" || status === "connecting"
            ? "warning"
            : "neutral";

  function toggleSidebar(): void {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-wago-canvas text-wago-ink">
      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onToggleCollapsed={toggleSidebar}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className={`transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-[208px]"}`}>
        <AppHeader
          title="Control"
          statusLabel={displayStatus}
          statusTone={statusTone}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="mx-auto max-w-[1360px] px-3 py-3 sm:px-4 lg:px-5">{children}</main>
      </div>
    </div>
  );
}
