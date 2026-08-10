import { LayoutDashboard, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { AppBrand } from "./AppBrand.js";

type AppSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

function ControlLink({ collapsed = false, onClick }: { collapsed?: boolean; onClick?: () => void }) {
  return (
    <a
      href="/"
      aria-current="page"
      aria-label={collapsed ? "Control" : undefined}
      title={collapsed ? "Control" : undefined}
      onClick={onClick}
      className={`flex h-9 items-center rounded-md bg-wago-brand-soft font-medium text-wago-brand-strong transition hover:bg-[#deebe5] ${
        collapsed ? "justify-center px-2" : "gap-2.5 px-3 text-sm"
      }`}
    >
      <LayoutDashboard size={16} />
      {!collapsed ? <span>Control</span> : null}
    </a>
  );
}

export function AppSidebar({ collapsed, mobileOpen, onToggleCollapsed, onCloseMobile }: AppSidebarProps) {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-wago-line bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[68px]" : "w-[208px]"
        }`}
      >
        <div className={`flex min-h-12 items-center border-b border-wago-line px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
          <AppBrand collapsed={collapsed} />
          {!collapsed ? (
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-wago-muted transition hover:bg-[#f2f4f2] hover:text-wago-ink"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          ) : null}
        </div>

        <nav className="px-2.5 py-3" aria-label="Application navigation">
          <ControlLink collapsed={collapsed} />
        </nav>

        {collapsed ? (
          <div className="mt-auto border-t border-wago-line p-2.5">
            <button
              className="inline-flex h-9 w-full items-center justify-center rounded-md text-wago-muted transition hover:bg-[#f2f4f2] hover:text-wago-ink"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        ) : null}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/20"
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-[252px] flex-col border-r border-wago-line bg-white shadow-xl">
            <div className="flex min-h-12 items-center justify-between border-b border-wago-line px-3">
              <AppBrand />
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-wago-muted transition hover:bg-[#f2f4f2] hover:text-wago-ink"
                type="button"
                onClick={onCloseMobile}
                aria-label="Close sidebar"
              >
                <X size={17} />
              </button>
            </div>
            <nav className="px-2.5 py-3" aria-label="Mobile application navigation">
              <ControlLink onClick={onCloseMobile} />
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
