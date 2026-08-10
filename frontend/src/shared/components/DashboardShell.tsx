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

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage?.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistSidebarCollapsed(value: boolean): void {
  try {
    window.localStorage?.setItem(SIDEBAR_STORAGE_KEY, String(value));
  } catch {
    // Storage can be unavailable in private, sandboxed or test environments.
  }
}

export function DashboardShell({ children, health, status, isRefreshing, onRefresh }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const displayStatus =
    health === "error" ? "Backend offline" : health === "checking" ? "Checking" : statusLabel[status];
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
      persistSidebarCollapsed(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen text-wago-ink">
      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onToggleCollapsed={toggleSidebar}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className={`transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[224px]"}`}>
        <AppHeader
          title="Control"
          statusLabel={displayStatus}
          statusTone={statusTone}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="mx-auto max-w-[1440px] px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-10">{children}</main>
      </div>
    </div>
  );
}
