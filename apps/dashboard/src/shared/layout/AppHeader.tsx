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
  positive: "bg-wago-positive",
  warning: "bg-wago-warning",
  danger: "bg-wago-danger",
  neutral: "bg-wago-tertiary",
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
    <header className="sticky top-0 z-20 border-b border-wago-line bg-white">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 md:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-wago-line bg-white text-wago-muted transition-colors hover:bg-wago-hover hover:text-wago-ink lg:hidden"
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu size={17} />
          </button>
          <div className="min-w-0">
            <h1 className="m-0 truncate text-[16px] font-semibold tracking-[-0.02em] text-wago-ink">{title}</h1>
            <p className="mt-0.5 hidden truncate text-xs text-wago-muted sm:block">{description}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {statusLabel ? (
            <div className="flex h-8 items-center gap-2 rounded-md border border-wago-line bg-white px-2.5 text-[11px] text-wago-secondary sm:px-3">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass[statusTone]}`} />
              <span className="max-w-[84px] truncate font-medium sm:max-w-[120px] md:max-w-none">{statusLabel}</span>
            </div>
          ) : null}
          {onRefresh ? (
            <button
              className="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-md border border-wago-control-line bg-white text-[11px] font-medium text-wago-ink transition-colors hover:bg-wago-hover disabled:cursor-wait disabled:text-wago-disabled sm:w-auto sm:px-3"
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={refreshLabel}
              title={refreshLabel}
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
