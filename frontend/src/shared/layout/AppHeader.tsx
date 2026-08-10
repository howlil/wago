import { Menu, RefreshCcw } from "lucide-react";

type AppHeaderProps = {
  title: string;
  statusLabel: string;
  statusTone: "positive" | "warning" | "danger" | "neutral";
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenMobileNav: () => void;
};

const statusDotClass: Record<AppHeaderProps["statusTone"], string> = {
  positive: "bg-[#2f8b67]",
  warning: "bg-[#ba8422]",
  danger: "bg-wago-danger",
  neutral: "bg-[#87918c]",
};

export function AppHeader({
  title,
  statusLabel,
  statusTone,
  isRefreshing,
  onRefresh,
  onOpenMobileNav,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-wago-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1360px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-wago-muted transition hover:bg-[#f2f4f2] hover:text-wago-ink lg:hidden"
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <h1 className="m-0 truncate text-[15px] font-semibold tracking-[-0.02em] text-wago-ink">{title}</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden h-7 items-center gap-1.5 rounded-md border border-wago-line bg-[#fafbfa] px-2 text-[11px] text-[#52615a] sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass[statusTone]}`} />
            <span className="font-medium">{statusLabel}</span>
          </div>
          <button
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#cfd7d2] bg-white px-2 text-[11px] font-medium text-[#2a3932] transition hover:bg-[#f5f7f5] disabled:cursor-wait disabled:text-[#89918d]"
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh status"
          >
            <RefreshCcw className={isRefreshing ? "animate-spin" : ""} size={13} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}
