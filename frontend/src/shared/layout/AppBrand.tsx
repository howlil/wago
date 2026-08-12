import { MessageCircleMore } from "lucide-react";

type AppBrandProps = {
  collapsed?: boolean;
};

export function AppBrand({ collapsed = false }: AppBrandProps) {
  return (
    <div className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wago-brand text-white">
        <MessageCircleMore size={18} strokeWidth={2.1} />
      </span>
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <strong className="block truncate text-[14px] font-semibold tracking-[-0.02em] text-wago-ink">Wago</strong>
            <span className="rounded-full bg-wago-brand-soft px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-wago-brand-strong">
              OSS
            </span>
          </div>
          <span className="mt-0.5 block truncate text-[10px] font-medium text-wago-muted">WhatsApp gateway</span>
        </div>
      ) : null}
    </div>
  );
}
