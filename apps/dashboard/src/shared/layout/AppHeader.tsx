import { Menu, RefreshCcw } from "lucide-react";
import { motion } from "motion/react";

type AppHeaderProps = {
  title: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
  onOpenMobileNav: () => void;
};

const headerMotion = { duration: 0.12, ease: "easeOut" } as const;

export function AppHeader({
  title,
  isRefreshing = false,
  onRefresh,
  refreshLabel = "Refresh",
  onOpenMobileNav,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-wago-workspace-line bg-wago-surface">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <motion.button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-wago-control-line bg-white text-wago-muted transition-colors hover:bg-wago-hover hover:text-wago-ink lg:hidden"
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
            whileTap={{ scale: 0.96 }}
            transition={headerMotion}
          >
            <Menu size={17} />
          </motion.button>
          <h1 className="m-0 truncate text-[15px] font-semibold tracking-[-0.02em] text-wago-ink">{title}</h1>
        </div>

        {onRefresh ? (
          <motion.button
            className="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-md border border-wago-control-line bg-white text-[11px] font-medium text-wago-ink transition-colors hover:bg-wago-hover disabled:cursor-wait disabled:text-wago-disabled sm:w-auto sm:px-3"
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={refreshLabel}
            title={refreshLabel}
            whileTap={isRefreshing ? undefined : { scale: 0.985 }}
            transition={headerMotion}
          >
            <RefreshCcw className={isRefreshing ? "animate-spin" : ""} size={13} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
        ) : null}
      </div>
    </header>
  );
}
