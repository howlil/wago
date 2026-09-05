import { Gauge, PanelLeftClose, PanelLeftOpen, ScrollText, Settings2, X } from "lucide-react";
import { motion } from "motion/react";
import { type ComponentType, Fragment } from "react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "../ui/sheet.js";
import { Tooltip } from "../ui/tooltip.js";
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

const navigationMotion = { duration: 0.14, ease: "easeOut" } as const;

function WorkspaceNavigation({
  activePath,
  collapsed = false,
  onNavigate,
  motionScope,
}: {
  activePath: WorkspacePath;
  collapsed?: boolean;
  onNavigate?: () => void;
  motionScope: "desktop" | "mobile";
}) {
  return (
    <div className="grid gap-1">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const active = activePath === item.href;
        const navigationLink = (
          <motion.a
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            onClick={onNavigate}
            whileHover={{ x: collapsed ? 0 : 1 }}
            whileTap={{ scale: 0.985 }}
            transition={navigationMotion}
            className={`relative isolate flex h-10 items-center overflow-hidden border-y border-transparent text-[13px] font-medium ${
              active ? "text-wago-ink" : "text-wago-secondary hover:bg-wago-console-row-hover hover:text-wago-ink"
            } ${collapsed ? "mx-auto w-10 justify-center" : "gap-2.5 px-3"}`}
          >
            {active ? (
              <>
                <motion.span
                  layoutId={`${motionScope}-global-active-surface`}
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 border-y border-wago-selected-line bg-wago-selected"
                  transition={navigationMotion}
                />
                <motion.span
                  layoutId={`${motionScope}-global-active-rule`}
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-0.5 bg-wago-brand"
                  transition={navigationMotion}
                />
              </>
            ) : null}
            <Icon className={`relative z-10 shrink-0 ${active ? "text-wago-brand-strong" : ""}`} size={17} />
            {!collapsed ? <span className="relative z-10">{item.label}</span> : null}
          </motion.a>
        );

        return (
          <Fragment key={item.href}>
            {collapsed ? <Tooltip content={item.label}>{navigationLink}</Tooltip> : navigationLink}
          </Fragment>
        );
      })}
    </div>
  );
}

export function AppSidebar({ activePath, collapsed, mobileOpen, onToggleCollapsed, onCloseMobile }: AppSidebarProps) {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-wago-workspace-line bg-wago-sidebar transition-[width] duration-150 lg:flex ${
          collapsed ? "w-14" : "w-[196px]"
        }`}
      >
        <div
          className={`flex min-h-12 items-center border-b border-wago-workspace-line px-3 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <AppBrand collapsed={collapsed} />
          {!collapsed ? (
            <Tooltip content="Collapse sidebar">
              <motion.button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-wago-muted transition-colors hover:bg-wago-hover hover:text-wago-ink"
                type="button"
                onClick={onToggleCollapsed}
                aria-label="Collapse sidebar"
                whileTap={{ scale: 0.96 }}
                transition={navigationMotion}
              >
                <PanelLeftClose size={16} />
              </motion.button>
            </Tooltip>
          ) : null}
        </div>

        <nav className="border-b border-wago-workspace-line px-2 py-2.5" aria-label="Application navigation">
          <WorkspaceNavigation activePath={activePath} collapsed={collapsed} motionScope="desktop" />
        </nav>

        {collapsed ? (
          <div className="mt-auto border-t border-wago-workspace-line p-2">
            <Tooltip content="Expand sidebar">
              <motion.button
                className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md text-wago-muted transition-colors hover:bg-wago-hover hover:text-wago-ink"
                type="button"
                onClick={onToggleCollapsed}
                aria-label="Expand sidebar"
                whileTap={{ scale: 0.96 }}
                transition={navigationMotion}
              >
                <PanelLeftOpen size={16} />
              </motion.button>
            </Tooltip>
          </div>
        ) : null}
      </aside>

      <Sheet
        open={mobileOpen}
        onOpenChange={(open) => {
          if (!open) onCloseMobile();
        }}
      >
        <SheetContent>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Application navigation</SheetDescription>
          <div className="flex min-h-12 items-center justify-between border-b border-wago-workspace-line px-3">
            <AppBrand />
            <SheetClose asChild>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-wago-muted transition-colors hover:bg-wago-hover hover:text-wago-ink"
                type="button"
                aria-label="Close sidebar"
              >
                <X size={17} />
              </button>
            </SheetClose>
          </div>
          <nav className="px-2 py-2.5" aria-label="Mobile application navigation">
            <WorkspaceNavigation activePath={activePath} onNavigate={onCloseMobile} motionScope="mobile" />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
