import { LayoutDashboard, RefreshCcw } from "lucide-react";
import type { ReactNode } from "react";
import type { WhatsAppBinding, WhatsAppStatus } from "../../api.js";

type DashboardShellProps = {
  children: ReactNode;
  appId: string;
  health: "checking" | "ok" | "error";
  status: WhatsAppStatus;
  binding: WhatsAppBinding;
  isRefreshing: boolean;
  onRefresh: () => void;
};

const statusLabel: Record<WhatsAppStatus, string> = {
  connecting: "Connecting",
  qr: "Waiting for QR",
  connected: "Connected",
  disconnected: "Disconnected",
};

export function DashboardShell({
  children,
  appId,
  health,
  status,
  binding,
  isRefreshing,
  onRefresh,
}: DashboardShellProps) {
  const online = health === "ok" && status === "connected";
  const displayStatus = health === "error" ? "Backend offline" : statusLabel[status];

  return (
    <div className="min-h-screen bg-wago-canvas text-wago-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-white/5 bg-wago-sidebar px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-wago-brand text-sm font-bold tracking-[-0.04em]">
            W
          </span>
          <div className="leading-tight">
            <strong className="block text-[15px] font-semibold tracking-[-0.02em]">Wago</strong>
            <span className="text-[11px] text-[#8fa89d]">Gateway control</span>
          </div>
        </div>

        <nav className="mt-7" aria-label="Application navigation">
          <a
            href="/"
            aria-current="page"
            className="flex items-center gap-2.5 rounded-md bg-white/8 px-3 py-2 text-sm font-medium text-white"
          >
            <LayoutDashboard size={16} />
            Control
          </a>
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-xs text-[#b6c7c0]">
            <span className={`h-2 w-2 rounded-full ${online ? "bg-[#67c99c]" : "bg-[#d4a763]"}`} />
            {displayStatus}
          </div>
          {binding.state === "bound" ? (
            <p className="mb-0 mt-2 font-mono text-[11px] text-[#8fa89d]">{binding.phone}</p>
          ) : null}
          <p className="mb-0 mt-3 break-all text-[10px] leading-4 text-[#718a80]">{appId}</p>
        </div>
      </aside>

      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-20 border-b border-wago-line bg-wago-canvas/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-7">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 lg:hidden">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-wago-brand text-[11px] font-bold text-white">W</span>
                <span className="text-xs font-semibold text-wago-brand-strong">Wago</span>
              </div>
              <h1 className="m-0 text-xl font-semibold tracking-[-0.025em]">Control</h1>
              <p className="mb-0 mt-0.5 hidden text-xs text-wago-muted sm:block">
                Manage the linked account, outbound access and recent gateway activity.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-wago-line bg-white px-2.5 py-2 text-xs sm:flex">
                <span className={`h-2 w-2 rounded-full ${online ? "bg-[#2f8b67]" : "bg-[#b17b1d]"}`} />
                <span className="font-medium text-[#435149]">{displayStatus}</span>
                {binding.state === "bound" ? <span className="font-mono text-[#7b8680]">· {binding.phone}</span> : null}
              </div>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#cfd7d2] bg-white px-3 text-sm font-medium text-[#2a3932] transition hover:bg-[#f4f6f4] disabled:cursor-wait disabled:text-[#89918d]"
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Refresh status"
              >
                <RefreshCcw className={isRefreshing ? "animate-spin" : ""} size={15} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1220px] px-4 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
