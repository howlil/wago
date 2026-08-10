import { Gauge, PanelLeftClose, PanelLeftOpen, ScrollText, X } from "lucide-react";
import type { ComponentType } from "react";
import { AppBrand } from "./AppBrand.js";

export type WorkspacePath = "/" | "/audit";

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
    <div className="grid gap-1.5">
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
            className={`group flex h-10 items-center rounded-xl border font-semibold transition ${
              active
                ? "border-[#cfe4da] bg-gradient-to-r from-[#edf8f3] to-[#f5fbf8] text-wago-brand-strong shadow-[0_4px_14px_rgba(23,107,77,0.06)] hover:border-[#bdd9cc] hover:shadow-[0_6px_18px_rgba(23,107,77,0.1)]"
                : "border-transparent text-[#607069] hover:border-[#e1e9e5] hover:bg-[#f7faf8] hover:text-wago-ink"
            } ${collapsed ? "justify-center px-2" : "gap-2.5 px-3 text-[13px]"}`}
          >
            <Icon className="shrink-0 transition-transform group-hover:scale-105" size={17} />
            {!collapsed ? <span>{item.label}</span> : null}
          </a>
        );
      })}
    </div>
  );
}

export function AppSidebar({
  activePath,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: AppSidebarProps) {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[#dfe8e3] bg-white/92 shadow-[8px_0_32px_rgba(22,55,42,0.035)] backdrop-blur-xl transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[76px]" : "w-[224px]"
        }`}
      >
        <div
          className={`flex min-h-[64px] items-center border-b border-[#e5ece8] px-3.5 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <AppBrand collapsed={collapsed} />
          {!collapsed ? (
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-wago-muted transition hover:bg-[#f0f5f2] hover:text-wago-ink"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          ) : null}
        </div>

        <div className={`px-3 pt-5 ${collapsed ? "text-center" : ""}`}>
          {!collapsed ? (
            <span className="px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#94a099]">Workspace</span>
          ) : null}
        </div>

        <nav className="px-2.5 py-2.5" aria-label="Application navigation">
          <WorkspaceNavigation activePath={activePath} collapsed={collapsed} />
        </nav>

        {!collapsed ? (
          <div className="mx-3 mt-auto mb-3 rounded-xl border border-[#e1e9e5] bg-[#f8faf9] p-3">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-wago-brand">Self-hosted</p>
            <p className="mt-1 mb-0 text-[10px] leading-4 text-wago-muted">
              Your session and gateway stay under your control.
            </p>
          </div>
        ) : (
          <div className="mt-auto border-t border-wago-line p-2.5">
            <button
              className="inline-flex h-10 w-full items-center justify-center rounded-xl text-wago-muted transition hover:bg-[#f0f5f2] hover:text-wago-ink"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-[#10251d]/35 backdrop-blur-[2px]"
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-[272px] flex-col border-r border-wago-line bg-white shadow-2xl">
            <div className="flex min-h-[64px] items-center justify-between border-b border-wago-line px-4">
              <AppBrand />
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-wago-muted transition hover:bg-[#f0f5f2] hover:text-wago-ink"
                type="button"
                onClick={onCloseMobile}
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-4 pt-5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#94a099]">Workspace</div>
            <nav className="px-3 py-2.5" aria-label="Mobile application navigation">
              <WorkspaceNavigation activePath={activePath} onNavigate={onCloseMobile} />
            </nav>
            <div className="mx-3 mt-auto mb-3 rounded-xl border border-[#e1e9e5] bg-[#f8faf9] p-3">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-wago-brand">Self-hosted</p>
              <p className="mt-1 mb-0 text-[10px] leading-4 text-wago-muted">
                Your session and gateway stay under your control.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
