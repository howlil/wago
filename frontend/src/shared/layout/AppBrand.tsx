type AppBrandProps = {
  collapsed?: boolean;
};

export function AppBrand({ collapsed = false }: AppBrandProps) {
  return (
    <div className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wago-brand text-sm font-bold tracking-[-0.04em] text-white">
        W
      </span>
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <strong className="block truncate text-[14px] font-semibold tracking-[-0.02em] text-wago-ink">Wago</strong>
          <span className="block truncate text-[10px] text-wago-muted">Gateway control</span>
        </div>
      ) : null}
    </div>
  );
}
