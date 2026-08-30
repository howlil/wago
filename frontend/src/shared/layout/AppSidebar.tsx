import { Gauge, PanelLeftClose, PanelLeftOpen, ScrollText, Settings2, X } from "lucide-react";
import type { ComponentType } from "react";
import { AppBrand } from "./AppBrand.js";

export type WorkspacePath = "/" | "/audit" | "/settings";

type NavigationItem = {
  href: WorkspacePath;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

type AppSidebarProps = {
  activePath: WorkspacePath;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Control", icon: Gauge },
  { href: "/settings", label: "Settings", icon: Settings2 },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

function WorkspaceNavigation({
  activePath,
  collapsed = false,
  onNavigate,
}: {
  activePath: WorkspacePath;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="grid gap-1">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const active = activePath === item.href;

        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
            className={`flex h-10 items-center rounded-md border text-[13px] font-medium transition-colors ${
              active
                ? "border-[#c9ddd3] bg-wago-brand-soft text-wago-brand-strong"
                : "border-transparent text-[#607069] hover:bg-[#f4f7f5] hover:text-wago-ink"
            } ${collapsed ? "mx-auto w-10 justify-center" : "gap-2.5 px-3"}`}
          >
            <Icon className="shrink-0" size={17} />
            {!collapsed ? <span>{item.label}</span> : null}
          </a>
        );
      })}
    </div>
  );
}

export function AppSidebar({ activePath, collapsed, mobileOpen, onToggleCollapsed, onCloseMobile }: AppSidebarProps) {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-wago-line bg-wago-sidebar transition-[width] duration-200 lg:flex ${
          collapsed ? "w-14" : "w-[196px]"
        }`}
      >
        <div
          className={`flex min-h-14 items-center border-b border-wago-line px-3 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <AppBrand collapsed={collapsed} />
          {!collapsed ? (
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-wago-muted transition-colors hover:bg-[#eef3f0] hover:text-wago-ink"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          ) : null}
        </div>

        {!collapsed ? (
          <div className="px-3 pt-3">
            <span className="px-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8a9690]">Workspace</span>
          </div>
        ) : null}

        <nav className="px-2 py-2" aria-label="Application navigation">
          <WorkspaceNavigation activePath={activePath} collapsed={collapsed} />
        </nav>

        {collapsed ? (
          <div className="mt-auto border-t border-wago-line p-2">
            <button
              className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md text-wago-muted transition-colors hover:bg-[#eef3f0] hover:text-wago-ink"
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
            className="absolute inset-0 bg-[#10251d]/35"
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-[248px] flex-col border-r border-wago-line bg-white shadow-2xl">
            <div className="flex min-h-14 items-center justify-between border-b border-wago-line px-3">
              <AppBrand />
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-wago-muted transition-colors hover:bg-[#eef3f0] hover:text-wago-ink"
                type="button"
                onClick={onCloseMobile}
                aria-label="Close sidebar"
              >
                <X size={17} />
              </button>
            </div>
            <div className="px-3 pt-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8a9690]">
              Workspace
            </div>
            <nav className="px-2 py-2" aria-label="Mobile application navigation">
              <WorkspaceNavigation activePath={activePath} onNavigate={onCloseMobile} />
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
