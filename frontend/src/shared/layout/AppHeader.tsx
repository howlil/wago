import { Menu, RefreshCcw } from "lucide-react";

type AppHeaderProps = {
  title: string;
  description: string;
  statusLabel?: string;
  statusTone?: "positive" | "warning" | "danger" | "neutral";
  isRefreshing?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
  onOpenMobileNav: () => void;
};

const statusDotClass: Record<NonNullable<AppHeaderProps["statusTone"]>, string> = {
  positive: "bg-[#2f9b70]",
  warning: "bg-[#ba8422]",
  danger: "bg-wago-danger",
  neutral: "bg-[#87918c]",
};

export function AppHeader({
  title,
  description,
  statusLabel,
  statusTone = "neutral",
  isRefreshing = false,
  onRefresh,
  refreshLabel = "Refresh",
  onOpenMobileNav,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-wago-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-[64px] max-w-[1440px] items-center justify-between gap-4 px-3 sm:px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-wago-line bg-white text-wago-muted transition-colors hover:bg-[#f4f7f5] hover:text-wago-ink lg:hidden"
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="m-0 truncate text-[16px] font-semibold tracking-[-0.02em] text-wago-ink">{title}</h1>
              <span className="hidden rounded-full border border-wago-line bg-[#f7faf8] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#75827c] sm:inline-flex">
                Gateway
              </span>
            </div>
            <p className="mt-0.5 hidden text-[10px] font-medium text-wago-muted sm:block">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {statusLabel ? (
            <div className="flex h-8 items-center gap-2 rounded-md border border-wago-line bg-white px-3 text-[11px] text-[#52615a]">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass[statusTone]}`} />
              <span className="max-w-[110px] truncate font-medium sm:max-w-none">{statusLabel}</span>
            </div>
          ) : null}
          {onRefresh ? (
            <button
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#cfdbd5] bg-white px-3 text-[11px] font-medium text-[#2a3932] transition-colors hover:bg-[#f4f7f5] disabled:cursor-wait disabled:text-[#89918d]"
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={refreshLabel}
            >
              <RefreshCcw className={isRefreshing ? "animate-spin" : ""} size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
