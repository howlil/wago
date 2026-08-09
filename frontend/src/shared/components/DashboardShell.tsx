import {
  Activity,
  KeyRound,
  LayoutDashboard,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

type DashboardShellProps = {
  children: ReactNode;
  appId: string;
  isRefreshing: boolean;
  onRefresh: () => void;
};

const navigation = [
  { href: "#overview", label: "Overview", icon: LayoutDashboard },
  { href: "#connection", label: "Connection", icon: Smartphone },
  { href: "#credentials", label: "Credentials", icon: KeyRound },
  { href: "#recipients", label: "Recipients", icon: UsersRound },
  { href: "#messaging", label: "Messaging", icon: MessageSquareText },
] as const;

export function DashboardShell({ children, appId, isRefreshing, onRefresh }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#f4f7f5] text-[#17231f]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#dbe5e0] bg-[#10251f] px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e765d]">
            <Activity size={20} />
          </span>
          <div>
            <strong className="block text-lg tracking-[-0.02em]">Wago</strong>
            <span className="text-xs text-[#9fc2b5]">WhatsApp Gateway</span>
          </div>
        </div>

        <nav className="mt-8 grid gap-1" aria-label="Dashboard sections">
          {navigation.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#c9ddd5] transition hover:bg-white/10 hover:text-white"
            >
              <Icon size={17} />
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#c9ddd5]">
            <ShieldCheck size={14} /> Single-account gateway
          </div>
          <p className="mt-2 break-all font-mono text-[11px] leading-5 text-[#89aa9e]">{appId}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[#dbe5e0] bg-[#f4f7f5]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f746b]">Gateway control</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-[28px]">Dashboard</h1>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#cfdad5] bg-white px-3.5 text-sm font-medium text-[#24352f] shadow-sm transition hover:bg-[#f7faf8] disabled:cursor-wait disabled:text-[#829089]"
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh status"
            >
              <RefreshCcw className={isRefreshing ? "animate-spin" : ""} size={16} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <nav
            className="flex gap-1 overflow-x-auto border-t border-[#e2e9e6] px-4 py-2 lg:hidden"
            aria-label="Dashboard sections"
          >
            {navigation.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-[#5d7168] hover:bg-white"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
