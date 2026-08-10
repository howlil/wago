import { type ReactNode, useState } from "react";
import { AppHeader } from "../layout/AppHeader.js";
import { AppSidebar, type WorkspacePath } from "../layout/AppSidebar.js";

type AppShellProps = {
  children: ReactNode;
  title: string;
  description: string;
  activePath: WorkspacePath;
  statusLabel?: string;
  statusTone?: "positive" | "warning" | "danger" | "neutral";
  isRefreshing?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
};

const SIDEBAR_STORAGE_KEY = "wago.sidebar.collapsed";

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

export function AppShell({
  children,
  title,
  description,
  activePath,
  statusLabel,
  statusTone,
  isRefreshing,
  onRefresh,
  refreshLabel,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
        activePath={activePath}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onToggleCollapsed={toggleSidebar}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className={`transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[224px]"}`}>
        <AppHeader
          title={title}
          description={description}
          statusLabel={statusLabel}
          statusTone={statusTone}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          refreshLabel={refreshLabel}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="mx-auto max-w-[1440px] px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-10">{children}</main>
      </div>
    </div>
  );
}
