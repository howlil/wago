import { type ReactNode, useEffect, useState } from "react";
import { AppHeader } from "../layout/AppHeader.js";
import { AppSidebar, type WorkspacePath } from "../layout/AppSidebar.js";

type AppShellProps = {
  children: ReactNode;
  title: string;
  activePath: WorkspacePath;
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

export function AppShell({ children, title, activePath, isRefreshing, onRefresh, refreshLabel }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const desktopViewport = window.matchMedia("(min-width: 1024px)");
    const closeMobileNavigation = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileNavOpen(false);
      }
    };

    if (desktopViewport.matches) {
      setMobileNavOpen(false);
    }

    desktopViewport.addEventListener("change", closeMobileNavigation);
    return () => desktopViewport.removeEventListener("change", closeMobileNavigation);
  }, []);

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

      <div className={`transition-[padding] duration-150 ${sidebarCollapsed ? "lg:pl-14" : "lg:pl-[196px]"}`}>
        <AppHeader
          title={title}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          refreshLabel={refreshLabel}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="px-4 pb-6 pt-3 md:px-5 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
